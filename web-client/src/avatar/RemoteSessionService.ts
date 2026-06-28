import type { LegacyAvatarState } from "./AvatarService";
import type { RemotePlayerRecord, RemotePlayerService } from "./RemotePlayerService";

type RemoteState = {
  pos?: VectorLike;
  ry?: number;
};

type VectorLike = {
  x?: number;
  y: number;
  z?: number;
  clone?(): VectorLike;
  copy?(value: VectorLike): void;
};

type AddRemoteOptions = {
  id: unknown;
  username: unknown;
  isStaff?: unknown;
  isBooster?: unknown;
  avatarData?: Record<string, unknown>;
  displayName(id: unknown, username: unknown): string;
  normalizeAvatar(data: Record<string, unknown>): LegacyAvatarState;
  readInitialState(data: Record<string, unknown>): RemoteState | null;
  createPosition(): VectorLike;
  canCreateMeshes(): boolean;
  makeRemote(username: string, id: unknown, avatar: LegacyAvatarState): unknown;
  setNameLabel(remote: RemotePlayerRecord, username: string): void;
  decodeRemoteState(data: Record<string, unknown>, remote: RemotePlayerRecord, source: string): void;
  noteState(remote: RemotePlayerRecord, status: string, reason: string, data?: Record<string, unknown>, source?: string): void;
  addLeaderboard(player: { id: unknown; username: string; is_staff?: unknown; is_booster?: unknown }): void;
  setFriendStatus(id: unknown, status: string): void;
  statusFor(id: unknown): string;
  onCreateError?(error: unknown): void;
};

type RemoveRemoteOptions = {
  clearBubble(id: unknown): void;
  disposeMeshes(meshes: unknown): void;
  removeLeaderboard(id: unknown): void;
};

type RemoteScenePositionResult = {
  state: { pos: VectorLike; ry: number } | null;
  reason: string;
};

type ApplyRemoteStateOptions = {
  source?: string;
  normalizeAvatar(data: Record<string, unknown>): LegacyAvatarState;
  avatarSignature(avatar: unknown): string;
  avatarPatch(data: unknown): Record<string, unknown> | null;
  readScenePosition(data: Record<string, unknown>): RemoteScenePositionResult;
  noteState(remote: RemotePlayerRecord, status: string, reason: string, data?: Record<string, unknown>, source?: string): void;
  applyAvatar(remote: RemotePlayerRecord, avatar: LegacyAvatarState): void;
  logRejected?(data: Record<string, unknown>, reason: string): void;
  now?: number;
};

type FrameOptions = {
  service: RemotePlayerService;
  dt: number;
  now?: number;
  shouldAnimate?: boolean;
  normalizeAvatar(input: Record<string, unknown>): LegacyAvatarState;
  displayName(id: unknown, username: unknown): string;
  noteState(remote: RemotePlayerRecord, status: string, reason: string): void;
  animate(id: unknown, remote: RemotePlayerRecord, dt: number): void;
  onCreateError?(error: unknown): void;
};

export class RemoteSessionService {
  private readonly remotesValue = new Map<unknown, RemotePlayerRecord>();
  private readonly pendingAvatarsValue = new Map<unknown, Record<string, unknown>>();
  private selfIdValue: unknown = null;

  get remotes(): Map<unknown, RemotePlayerRecord> {
    return this.remotesValue;
  }

  get pendingAvatars(): Map<unknown, Record<string, unknown>> {
    return this.pendingAvatarsValue;
  }

  get selfId(): unknown {
    return this.selfIdValue;
  }

  set selfId(value: unknown) {
    this.selfIdValue = value;
  }

  has(id: unknown): boolean {
    return this.remotesValue.has(id);
  }

  get(id: unknown): RemotePlayerRecord | undefined {
    return this.remotesValue.get(id);
  }

  applyKnownPlayerName(id: unknown, username: unknown, options: {
    remember(id: unknown, username: unknown): string;
    setNameLabel(remote: RemotePlayerRecord, username: string): void;
    addLeaderboard(player: { id: unknown; username: string; is_staff?: unknown; is_booster?: unknown }): void;
  }): string {
    const playerId = Number(id);
    if (!Number.isFinite(playerId) || playerId <= 0) return "";
    const name = options.remember(playerId, username);
    if (!name) return "";
    const remote = this.remotesValue.get(playerId);
    if (remote && remote.username !== name) {
      remote.username = name;
      options.setNameLabel(remote, name);
    }
    const pending = this.pendingAvatarsValue.get(playerId);
    if (pending) pending.username = name;
    options.addLeaderboard({ id: playerId, username: name, is_staff: remote?.is_staff, is_booster: remote?.is_booster });
    return name;
  }

  addRemote(options: AddRemoteOptions): RemotePlayerRecord {
    const displayName = options.displayName(options.id, options.username);
    if (this.remotesValue.has(options.id)) {
      const remote = this.remotesValue.get(options.id)!;
      if (displayName && displayName !== remote.username) {
        remote.username = displayName;
        options.setNameLabel(remote, displayName);
      }
      remote.is_staff = options.isStaff ?? remote.is_staff;
      remote.is_booster = options.isBooster ?? remote.is_booster;
      options.decodeRemoteState(options.avatarData || {}, remote, "addRemote");
      options.addLeaderboard({ id: options.id, username: String(remote.username || displayName), is_staff: remote.is_staff, is_booster: remote.is_booster });
      return remote;
    }

    const avatar = options.normalizeAvatar(options.avatarData || {});
    const initialState = options.readInitialState(options.avatarData || {});
    let meshes: unknown = null;
    if (options.canCreateMeshes()) {
      try {
        meshes = options.makeRemote(displayName, options.id, avatar);
      } catch (error) {
        options.onCreateError?.(error);
      }
    }
    if (!meshes) this.pendingAvatarsValue.set(options.id, {
      username: displayName,
      is_staff: options.isStaff,
      is_booster: options.isBooster,
      ...avatar
    });

    const remote: RemotePlayerRecord = {
      meshes: (meshes || null) as RemotePlayerRecord["meshes"],
      tPos: ((initialState?.pos?.clone?.() || options.createPosition()) as RemotePlayerRecord["tPos"]),
      tRy: initialState?.ry || 0,
      anim: "idle",
      animTime: 0,
      seen: initialState ? performance.now() : 0,
      hasPosition: Boolean(initialState),
      id: options.id,
      username: displayName,
      is_staff: options.isStaff,
      is_booster: options.isBooster,
      avatar
    };
    if (initialState) options.noteState(remote, "accepted", "", options.avatarData || {}, "addRemote");
    this.syncCreatedRemote(remote);
    this.remotesValue.set(options.id, remote);
    options.addLeaderboard({ id: options.id, username: displayName, is_staff: options.isStaff, is_booster: options.isBooster });
    options.setFriendStatus(options.id, options.statusFor(options.id));
    return remote;
  }

  removeRemote(id: unknown, options: RemoveRemoteOptions): boolean {
    const remote = this.remotesValue.get(id);
    if (!remote) return false;
    options.clearBubble(id);
    try {
      options.disposeMeshes(remote.meshes);
    } catch {
      // Leave handling must still clear runtime and UI state if a remote clone is malformed.
    }
    finally {
      this.pendingAvatarsValue.delete(id);
      this.remotesValue.delete(id);
      options.removeLeaderboard(id);
    }
    return true;
  }

  applyRemoteState(playerData: Record<string, unknown>, remote: RemotePlayerRecord, options: ApplyRemoteStateOptions): boolean {
    const source = options.source || "states";
    options.noteState(remote, "received", "", playerData, source);

    const avatarPatch = options.avatarPatch(playerData);
    if (avatarPatch) {
      const nextAvatar = options.normalizeAvatar({ ...(remote.avatar || {}), ...avatarPatch });
      const previousSignature = options.avatarSignature(remote.avatar || {});
      const nextSignature = options.avatarSignature(nextAvatar);
      if (previousSignature !== nextSignature) {
        remote.avatar = nextAvatar;
        if (remote.meshes) options.applyAvatar(remote, nextAvatar);
      }
    }

    if (![playerData.x, playerData.y, playerData.z, playerData.ry].every(Number.isFinite)) {
      options.noteState(remote, "rejected", "non-finite-position", playerData, source);
      return false;
    }

    const result = options.readScenePosition(playerData);
    if (!result.state) {
      const reason = `invalid-position:${result.reason}`;
      options.noteState(remote, "rejected", reason, playerData, source);
      options.logRejected?.(playerData, reason);
      return false;
    }

    remote.tPos?.copy?.(result.state.pos);
    remote.tRy = result.state.ry;
    remote.anim = String(playerData.anim || "");
    remote.seen = options.now ?? performance.now();
    remote.hasPosition = true;
    options.noteState(remote, "accepted", "", playerData, source);
    if (remote.meshes && !remote.meshes.grp.visible) {
      remote.meshes.grp.position.copy?.(result.state.pos);
      remote.meshes.grp.rotation.y = result.state.ry;
      remote.meshes.grp.visible = true;
    }
    return true;
  }

  updateFrame(options: FrameOptions): void {
    const payload: Parameters<RemotePlayerService["updateFrame"]>[0] = {
      remotes: this.remotesValue,
      pendingAvatars: this.pendingAvatarsValue,
      dt: options.dt,
      normalizeAvatar: options.normalizeAvatar,
      displayName: options.displayName,
      noteState: options.noteState,
      animate: options.animate
    };
    if (options.now !== undefined) payload.now = options.now;
    if (options.shouldAnimate !== undefined) payload.shouldAnimate = options.shouldAnimate;
    if (options.onCreateError) payload.onCreateError = options.onCreateError;
    options.service.updateFrame(payload);
  }

  rebuildAll(options: {
    service: RemotePlayerService;
    normalizeAvatar(input: Record<string, unknown>): LegacyAvatarState;
    onError?: (error: unknown) => void;
  }): void {
    const payload: Parameters<RemotePlayerService["rebuildAll"]>[0] = {
      remotes: this.remotesValue,
      normalizeAvatar: options.normalizeAvatar
    };
    if (options.onError) payload.onError = options.onError;
    options.service.rebuildAll(payload);
  }

  commandPlayerList(options: {
    localId: unknown;
    localUsername: string;
    localPosition: unknown;
  }): Array<{ id: unknown; username: string; self: boolean; pos: unknown }> {
    const out: Array<{ id: unknown; username: string; self: boolean; pos: unknown }> = [];
    if (options.localId !== null && options.localId !== undefined) {
      out.push({
        id: options.localId,
        username: options.localUsername,
        self: true,
        pos: options.localPosition
      });
    }
    for (const [id, remote] of this.remotesValue) {
      out.push({
        id,
        username: String(remote.username || id),
        self: false,
        pos: remote.hasPosition ? (remote.tPos?.clone?.() || remote.meshes?.grp?.position?.clone?.() || null) : null
      });
    }
    return out;
  }

  snapshot(): { remotes: number; pendingAvatars: number; selfId: unknown } {
    return {
      remotes: this.remotesValue.size,
      pendingAvatars: this.pendingAvatarsValue.size,
      selfId: this.selfIdValue
    };
  }

  reset(): void {
    this.remotesValue.clear();
    this.pendingAvatarsValue.clear();
    this.selfIdValue = null;
  }

  private syncCreatedRemote(remote: RemotePlayerRecord): void {
    if (!remote.meshes) return;
    if (remote.hasPosition && remote.tPos) {
      remote.meshes.grp.position.copy?.(remote.tPos);
      remote.meshes.grp.rotation.y = Number(remote.tRy || 0);
      remote.meshes.grp.visible = true;
    } else {
      remote.meshes.grp.visible = false;
    }
  }
}
