import { BrokeredRelaySocket, type BrokeredSocketWindow } from "./relay/BrokeredRelaySocket";
import {
  BroadcastStateTracker,
  buildLocalBroadcastState as buildLocalBroadcastStateValue,
  buildStateAtScenePosition as buildStateAtScenePositionValue,
  encodeNetworkState,
  type LocalBroadcastState,
  type LocalPlayerBroadcastInput
} from "./relay/BroadcastState";
import {
  fetchFriendLists,
  FriendStatusRegistry,
  type FriendStatus
} from "./relay/FriendStatusRegistry";
import { PlayerNameRegistry } from "./relay/PlayerNameRegistry";
import {
  buildHubUrl,
  createRelayHello,
  isLocalRelayUrl,
  isSocketConnecting,
  isSocketOpen,
  planBridgeConnection,
  type BridgeConnectionPlan,
  type RelayHelloAvatar,
  type RelayHelloPayload
} from "./relay/RelayConnectionPlanning";
import {
  readRemoteScenePosition,
  remoteAvatarPatch,
  RemoteStateDebugTracker,
  type DebuggableRemote,
  type RemoteAvatarPatch,
  type RemoteDebugRow,
  type RemoteRawState,
  type RemoteScenePositionResult,
  type RemoteStateDebug,
  type RemoteStateStatus
} from "./relay/RemoteStateDebug";
import type { BridgeConfig, LaunchIdentity } from "../platform/PlatformBridge";

export type {
  BridgeConnectionPlan,
  FriendStatus,
  LocalBroadcastState,
  LocalPlayerBroadcastInput,
  RelayHelloAvatar,
  RelayHelloPayload,
  RemoteAvatarPatch,
  RemoteDebugRow,
  RemoteRawState,
  RemoteScenePositionResult,
  RemoteStateDebug,
  RemoteStateStatus
};

export type MultiplayerMessageSummary = {
  type: string;
  at: string;
  playerCount: number;
  ids: number[];
  id?: number;
};

export class MultiplayerService {
  private readonly messages: MultiplayerMessageSummary[] = [];
  private readonly pendingEngineMessages: unknown[] = [];
  private readonly names = new PlayerNameRegistry();
  private readonly friends = new FriendStatusRegistry();
  private readonly remoteDebug = new RemoteStateDebugTracker();
  private readonly broadcast = new BroadcastStateTracker();
  private reconnectAttempts = 0;
  private flushingEngineMessages = false;

  recordMessage(message: unknown, enabled = true): void {
    if (!enabled || !message || typeof message !== "object") return;
    const typed = message as { type?: unknown; players?: unknown; id?: unknown };
    if (!typed.type) return;
    const players = Array.isArray(typed.players) ? typed.players : [];
    const messageId = readId(typed);
    const summary: MultiplayerMessageSummary = {
      type: String(typed.type),
      at: new Date().toISOString(),
      playerCount: players.length,
      ids: players.slice(0, 16).map(readId).filter((id) => id > 0)
    };
    if (messageId) summary.id = messageId;
    this.messages.push(summary);
    while (this.messages.length > 200) this.messages.shift();
  }

  messagesSnapshot(): MultiplayerMessageSummary[] {
    return this.messages.map((message) => ({ ...message, ids: [...message.ids] }));
  }

  queueUntilEngineReady(message: unknown, engineReady: boolean): boolean {
    if (engineReady) return false;
    if (message && typeof message === "object" && (message as { type?: unknown }).type === "kicked") return false;
    this.pendingEngineMessages.push(message);
    if (this.pendingEngineMessages.length > 200) {
      this.pendingEngineMessages.splice(0, this.pendingEngineMessages.length - 200);
    }
    return true;
  }

  flushQueuedEngineMessages(engineReady: () => boolean, handleMessage: (message: unknown) => void): void {
    if (this.flushingEngineMessages || !engineReady()) return;
    this.flushingEngineMessages = true;
    try {
      while (this.pendingEngineMessages.length && engineReady()) {
        handleMessage(this.pendingEngineMessages.shift());
      }
    } finally {
      this.flushingEngineMessages = false;
    }
  }

  pendingEngineMessageCount(): number {
    return this.pendingEngineMessages.length;
  }

  isPlaceholderPlayerName(id: unknown, value: unknown): boolean {
    return this.names.isPlaceholder(id, value);
  }

  rememberPlayerName(id: unknown, username: unknown): string {
    return this.names.remember(id, username);
  }

  playerDisplayName(id: unknown, username: unknown): string {
    return this.names.displayName(id, username);
  }

  knownNamesSnapshot(): Record<number, string> {
    return this.names.snapshot();
  }

  replaceFriendLists(friends: unknown[] = [], incoming: unknown[] = [], outgoing: unknown[] = []): void {
    this.friends.replace(friends, incoming, outgoing);
  }

  async fetchAndReplaceFriendLists(fetcher: typeof fetch): Promise<void> {
    this.friends.replace(...await fetchFriendLists(fetcher));
  }

  friendStatus(id: unknown): FriendStatus {
    return this.friends.status(id);
  }

  friendStatusMap(ids: Iterable<unknown>): Record<string, FriendStatus> {
    return this.friends.statusMap(ids);
  }

  setFriendStatus(id: unknown, status: FriendStatus): FriendStatus {
    return this.friends.set(id, status);
  }

  createBrokeredSocket(url: string, windowRef?: BrokeredSocketWindow): BrokeredRelaySocket {
    return new BrokeredRelaySocket(url, windowRef);
  }

  isLocalRelayUrl(value: unknown): boolean {
    return isLocalRelayUrl(value);
  }

  planBridgeConnection(config: Pick<BridgeConfig, "hubUrl" | "brokered" | "devLocalRelay">): BridgeConnectionPlan {
    return planBridgeConnection(config);
  }

  buildHubUrl(config: Pick<BridgeConfig, "hubUrl" | "officialGameId">, launchInfo: Pick<LaunchIdentity, "gameId">, localRelay: boolean, fallbackGameId = 0): string {
    return buildHubUrl(config, launchInfo, localRelay, fallbackGameId);
  }

  createRelayHello(input: {
    launchInfo: LaunchIdentity;
    config: Pick<BridgeConfig, "officialGameId" | "launchToken" | "identity">;
    localRelay: boolean;
    brokeredRelay: boolean;
    fallbackGameId?: number;
    avatarOverride?: RelayHelloAvatar | null;
  }): RelayHelloPayload {
    return createRelayHello(input);
  }

  isSocketOpen(socket: unknown): boolean {
    return isSocketOpen(socket);
  }

  isSocketConnecting(socket: unknown): boolean {
    return isSocketConnecting(socket);
  }

  ensureRemoteDebug(remote: DebuggableRemote): RemoteStateDebug {
    return this.remoteDebug.ensure(remote);
  }

  noteRemoteState(
    remote: DebuggableRemote | null | undefined,
    status: RemoteStateStatus,
    reason = "",
    playerData?: RemoteRawState | null,
    source = ""
  ): void {
    this.remoteDebug.note(remote, status, reason, playerData, source);
  }

  remoteDebugRows(remotes: Map<unknown, DebuggableRemote>, now = performance.now()): RemoteDebugRow[] {
    return this.remoteDebug.rows(remotes, now);
  }

  shouldLogBadRemoteState(id: unknown, now = performance.now(), throttleMs = 3000): boolean {
    return this.remoteDebug.shouldLogBadState(id, now, throttleMs);
  }

  remoteAvatarPatch(playerData: unknown): RemoteAvatarPatch | null {
    return remoteAvatarPatch(playerData);
  }

  readRemoteScenePosition(playerData: RemoteRawState | null | undefined, convertNativeYToSceneY: (nativeY: number) => number): RemoteScenePositionResult {
    return readRemoteScenePosition(playerData, convertNativeYToSceneY);
  }

  nativeFootOffset(value: unknown): number {
    const offset = Number(value);
    return Number.isFinite(offset) && Math.abs(offset) < 10 ? offset : NATIVE_CHARACTER_FOOT_OFFSET;
  }

  nativeYToSceneY(nativeY: unknown, nativeFootOffset: number, sceneFootOffset: number): number {
    return Number(nativeY) - nativeFootOffset + sceneFootOffset;
  }

  sceneYToNativeY(sceneY: unknown, nativeFootOffset: number, sceneFootOffset: number): number {
    return Number(sceneY) - sceneFootOffset + nativeFootOffset;
  }

  shouldBroadcastLocalState(state: LocalBroadcastState, now = performance.now()): boolean {
    return this.broadcast.shouldBroadcast(state, now);
  }

  buildLocalBroadcastState(input: LocalPlayerBroadcastInput): LocalBroadcastState {
    return buildLocalBroadcastStateValue(input, this.normalizeYaw);
  }

  buildStateAtScenePosition(input: {
    position: VectorLike;
    rotationY: unknown;
    anim?: string;
    convertSceneYToNative: (sceneY: number) => number;
  }): LocalBroadcastState {
    return buildStateAtScenePositionValue(input, this.normalizeYaw);
  }

  normalizeYaw(value: unknown): number {
    let ry = Number(value || 0) % (2 * Math.PI);
    if (ry > Math.PI) ry -= 2 * Math.PI;
    else if (ry < -Math.PI) ry += 2 * Math.PI;
    return ry;
  }

  encodeNetworkData(data: LocalBroadcastState): LocalBroadcastState {
    return encodeNetworkState(data);
  }

  resetLocalBroadcast(): void {
    this.broadcast.reset();
  }

  resetReconnect(): void {
    this.reconnectAttempts = 0;
  }

  planReconnect(label = "relay", kicked = false): ReconnectPlan {
    if (kicked) {
      return {
        kicked: true,
        exhausted: false,
        shouldReconnect: false,
        attempt: this.reconnectAttempts,
        delayMs: 0,
        message: ""
      };
    }
    if (this.reconnectAttempts >= MAX_RECONNECTS) {
      return {
        kicked: false,
        exhausted: true,
        shouldReconnect: false,
        attempt: this.reconnectAttempts,
        delayMs: 0,
        message: `Vortex Web ${label} disconnected. Reload the page to retry.`
      };
    }
    this.reconnectAttempts += 1;
    const delayMs = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * Math.pow(1.45, this.reconnectAttempts - 1));
    return {
      kicked: false,
      exhausted: false,
      shouldReconnect: true,
      attempt: this.reconnectAttempts,
      delayMs,
      message: `Vortex Web ${label} disconnected. Reconnecting in ${(delayMs / 1000).toFixed(1)}s...`
    };
  }

  reset(): void {
    this.messages.length = 0;
    this.pendingEngineMessages.length = 0;
    this.names.clear();
    this.friends.clear();
    this.remoteDebug.clear();
    this.resetLocalBroadcast();
    this.resetReconnect();
  }
}

export type ReconnectPlan = {
  kicked: boolean;
  exhausted: boolean;
  shouldReconnect: boolean;
  attempt: number;
  delayMs: number;
  message: string;
};

type VectorLike = {
  x?: unknown;
  y?: unknown;
  z?: unknown;
};

const MAX_RECONNECTS = 20;
const RECONNECT_BASE_MS = 1200;
const RECONNECT_MAX_MS = 15000;
const NATIVE_CHARACTER_FOOT_OFFSET = 2.0;

function readId(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  return Number((value as { id?: unknown }).id || 0) || 0;
}
