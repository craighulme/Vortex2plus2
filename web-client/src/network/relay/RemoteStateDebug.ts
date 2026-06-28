export type RemoteStateStatus = "received" | "accepted" | "rejected" | "hidden";

export type RemoteStateDebug = {
  received: number;
  accepted: number;
  rejected: number;
  lastReceivedAt: number;
  lastAcceptedAt: number;
  lastRejectedAt: number;
  lastRejectedReason: string;
  lastSource: string;
  lastRaw: RemoteRawState | null;
  hiddenReason: string;
};

export type RemoteRawState = {
  x?: unknown;
  y?: unknown;
  z?: unknown;
  ry?: unknown;
  anim?: unknown;
};

export type RemoteAvatarPatch = {
  shirt_id?: number;
  pant_id?: number;
  body_type?: unknown;
  body_colors?: unknown[];
  face_id?: number;
};

export type RemoteDebugRow = {
  id: number;
  username: string;
  visible: boolean;
  hasPosition: boolean;
  ageMs: number | null;
  received: number;
  accepted: number;
  rejected: number;
  lastRejectedReason: string;
  hiddenReason: string;
  lastSource: string;
  lastRaw: RemoteRawState | null;
  target: VectorSnapshot | null;
  mesh: VectorSnapshot | null;
};

export type RemoteSceneState = {
  pos: VectorSnapshot;
  ry: number;
};

export type RemoteScenePositionResult = {
  state: RemoteSceneState | null;
  reason: string;
};

type VectorSnapshot = {
  x: number;
  y: number;
  z: number;
};

export type DebuggableRemote = {
  username?: unknown;
  hasPosition?: unknown;
  seen?: unknown;
  tPos?: VectorLike | null;
  meshes?: {
    grp?: {
      visible?: unknown;
      position?: VectorLike | null;
    } | null;
  } | null;
  stateDebug?: RemoteStateDebug;
};

type VectorLike = {
  x?: unknown;
  y?: unknown;
  z?: unknown;
};

export class RemoteStateDebugTracker {
  private readonly badRemoteStateLog = new Map<string | number, number>();

  ensure(remote: DebuggableRemote): RemoteStateDebug {
    if (!remote.stateDebug) {
      remote.stateDebug = {
        received: 0,
        accepted: 0,
        rejected: 0,
        lastReceivedAt: 0,
        lastAcceptedAt: 0,
        lastRejectedAt: 0,
        lastRejectedReason: "",
        lastSource: "",
        lastRaw: null,
        hiddenReason: ""
      };
    }
    return remote.stateDebug;
  }

  note(remote: DebuggableRemote | null | undefined, status: RemoteStateStatus, reason = "", playerData?: RemoteRawState | null, source = ""): void {
    if (!remote) return;
    const debug = this.ensure(remote);
    const now = performance.now();
    debug.lastSource = source || "";
    debug.lastRaw = playerData ? {
      x: playerData.x,
      y: playerData.y,
      z: playerData.z,
      ry: playerData.ry,
      anim: playerData.anim
    } : null;

    if (status === "received") {
      debug.received += 1;
      debug.lastReceivedAt = now;
    } else if (status === "accepted") {
      debug.accepted += 1;
      debug.lastAcceptedAt = now;
      debug.hiddenReason = "";
    } else if (status === "rejected") {
      debug.rejected += 1;
      debug.lastRejectedAt = now;
      debug.lastRejectedReason = reason || "unknown";
    } else if (status === "hidden") {
      debug.hiddenReason = reason || "hidden";
    }
  }

  rows(remotes: Map<unknown, DebuggableRemote>, now = performance.now()): RemoteDebugRow[] {
    return [...remotes.entries()].map(([id, remote]) => {
      const grp = remote.meshes?.grp || null;
      const debug = remote.stateDebug;
      return {
        id: Number(id),
        username: String(remote.username || ""),
        visible: Boolean(grp?.visible),
        hasPosition: Boolean(remote.hasPosition),
        ageMs: Number(remote.seen) ? Math.round(now - Number(remote.seen)) : null,
        received: debug?.received || 0,
        accepted: debug?.accepted || 0,
        rejected: debug?.rejected || 0,
        lastRejectedReason: debug?.lastRejectedReason || "",
        hiddenReason: debug?.hiddenReason || "",
        lastSource: debug?.lastSource || "",
        lastRaw: debug?.lastRaw || null,
        target: readVector(remote.hasPosition ? remote.tPos : null),
        mesh: readVector(grp?.position)
      };
    });
  }

  shouldLogBadState(id: unknown, now = performance.now(), throttleMs = 3000): boolean {
    const playerId = Number(id || 0) || "unknown";
    const last = this.badRemoteStateLog.get(playerId) || 0;
    if (now - last < throttleMs) return false;
    this.badRemoteStateLog.set(playerId, now);
    return true;
  }

  clear(): void {
    this.badRemoteStateLog.clear();
  }
}

export function remoteAvatarPatch(playerData: unknown): RemoteAvatarPatch | null {
  if (!playerData || typeof playerData !== "object") return null;
  const data = playerData as Record<string, unknown>;
  const hasAvatarField = data.shirt_id !== undefined ||
    data.pant_id !== undefined ||
    data.body_type !== undefined ||
    data.body_colors !== undefined ||
    data.face_id !== undefined;
  if (!hasAvatarField) return null;
  const patch: RemoteAvatarPatch = {};
  if (data.shirt_id !== undefined) patch.shirt_id = Number(data.shirt_id) || 0;
  if (data.pant_id !== undefined) patch.pant_id = Number(data.pant_id) || 0;
  if (data.body_type !== undefined) patch.body_type = data.body_type;
  if (Array.isArray(data.body_colors) && data.body_colors.length === 6) patch.body_colors = data.body_colors;
  if (data.face_id !== undefined) patch.face_id = Number(data.face_id) || 0;
  return patch;
}

export function readRemoteScenePosition(playerData: RemoteRawState | null | undefined, convertNativeYToSceneY: (nativeY: number) => number): RemoteScenePositionResult {
  if (![playerData?.x, playerData?.y, playerData?.z, playerData?.ry].every(Number.isFinite)) {
    return { state: null, reason: "non-finite-position" };
  }
  const data = playerData as Required<RemoteRawState>;
  const x = Number(data.x);
  const y = convertNativeYToSceneY(Number(data.y));
  const z = Number(data.z);
  const ry = Number(data.ry);
  if (![x, y, z, ry].every(Number.isFinite)) return { state: null, reason: "converted-non-finite-position" };
  if (Math.abs(x) > REMOTE_MAX_ABS_COORD || Math.abs(y) > REMOTE_MAX_ABS_COORD || Math.abs(z) > REMOTE_MAX_ABS_COORD) {
    return { state: null, reason: "out-of-range-position" };
  }
  if (y < REMOTE_MIN_SCENE_Y) return { state: null, reason: "below-scene-floor" };
  return { state: { pos: { x, y, z }, ry }, reason: "" };
}

function readVector(value: VectorLike | null | undefined): VectorSnapshot | null {
  if (!value) return null;
  const x = Number(value.x);
  const y = Number(value.y);
  const z = Number(value.z);
  return Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z) ? { x, y, z } : null;
}

const REMOTE_MIN_SCENE_Y = -250;
const REMOTE_MAX_ABS_COORD = 100000;
