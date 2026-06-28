import type { ProtocolService } from "../protocol";
import type { LocalBroadcastState } from "../MultiplayerService";
import type { LaunchIdentity } from "../../platform/PlatformBridge";

export type SocketLike = {
  readyState?: number;
  send(data: string | ArrayBuffer): void;
  close?: () => void;
  binaryType?: string;
  onopen?: ((event?: unknown) => void) | null;
  onmessage?: ((event: { data: unknown }) => void) | null;
  onclose?: ((event?: unknown) => void) | null;
  onerror?: ((event?: unknown) => void) | null;
  _kicked?: boolean;
  _retry?: ReturnType<typeof setTimeout>;
};

export type PayloadEncoders = {
  encodeMovement(data: LocalBroadcastState): ArrayBuffer;
  encodeChat(message: unknown): ArrayBuffer;
};

export class MultiplayerSessionService {
  private socketValue: SocketLike | null = null;
  private launchInfoValue: LaunchIdentity | null = null;
  private connectPromiseValue: Promise<unknown> | null = null;
  private connectFinishedValue = false;
  private hubModeValue = false;
  private animClockValue = 0;
  private broadcastTimerValue: ReturnType<typeof setInterval> | null = null;
  private broadcastOverrideValue: { state: Record<string, unknown>; until: number } | null = null;

  get socket(): SocketLike | null {
    return this.socketValue;
  }

  set socket(value: SocketLike | null) {
    this.socketValue = value;
  }

  get launchInfo(): LaunchIdentity | null {
    return this.launchInfoValue;
  }

  set launchInfo(value: LaunchIdentity | null) {
    this.launchInfoValue = value;
  }

  get hubMode(): boolean {
    return this.hubModeValue;
  }

  set hubMode(value: boolean) {
    this.hubModeValue = Boolean(value);
  }

  get connectFinished(): boolean {
    return this.connectFinishedValue;
  }

  set connectFinished(value: boolean) {
    this.connectFinishedValue = Boolean(value);
  }

  get animClock(): number {
    return this.animClockValue;
  }

  runConnect(connectOnce: () => Promise<unknown>, socketBusy: (socket: SocketLike | null) => boolean): Promise<unknown> | undefined {
    if (this.connectFinishedValue) return undefined;
    if (socketBusy(this.socketValue)) return undefined;
    if (this.connectPromiseValue) return this.connectPromiseValue;
    this.connectPromiseValue = connectOnce().finally(() => {
      this.connectPromiseValue = null;
    });
    return this.connectPromiseValue;
  }

  resetForReconnect(): SocketLike | null {
    const closedSocket = this.socketValue;
    this.socketValue = null;
    this.connectFinishedValue = false;
    return closedSocket;
  }

  clearRetry(): void {
    const retry = this.socketValue?._retry;
    if (retry) clearTimeout(retry);
  }

  updateLaunchAvatar(avatar: {
    shirt_id: number;
    pant_id: number;
    body_type: string;
    body_colors: unknown[];
    face_id: number;
  } | null): typeof avatar {
    if (!avatar || !this.launchInfoValue) return null;
    this.launchInfoValue.shirtId = avatar.shirt_id;
    this.launchInfoValue.pantId = avatar.pant_id;
    this.launchInfoValue.bodyType = avatar.body_type;
    this.launchInfoValue.bodyColors = avatar.body_colors;
    this.launchInfoValue.faceId = avatar.face_id;
    return avatar;
  }

  encodeMovementPacket(protocol: ProtocolService, data: LocalBroadcastState): ArrayBuffer {
    if (!this.launchInfoValue) throw new Error("movement packet requires launch identity");
    const encoded = protocol.encodeMovementPacket(data, this.launchInfoValue, this.animClockValue);
    this.animClockValue = encoded.animClock;
    return encoded.buffer;
  }

  encodeHeartbeat(protocol: ProtocolService): ArrayBuffer {
    if (!this.launchInfoValue) throw new Error("heartbeat packet requires launch identity");
    return protocol.encodeHeartbeat(this.launchInfoValue);
  }

  encodeChatPacket(protocol: ProtocolService, message: unknown): ArrayBuffer {
    if (!this.launchInfoValue) throw new Error("chat packet requires launch identity");
    return protocol.encodeChatPacket(message, this.launchInfoValue);
  }

  sendPayload(payload: Record<string, unknown> & { type?: unknown; msg?: unknown }, encoders: PayloadEncoders): boolean {
    if (!this.socketValue || !this.launchInfoValue) return false;
    if (this.hubModeValue) {
      this.socketValue.send(JSON.stringify(payload));
      return true;
    }
    if (payload.type === "state") {
      this.socketValue.send(encoders.encodeMovement(payload as LocalBroadcastState));
      return true;
    }
    if (payload.type === "chat") {
      this.socketValue.send(encoders.encodeChat(payload.msg));
      return true;
    }
    return false;
  }

  sendJson(payload: unknown): boolean {
    if (!this.socketValue) return false;
    this.socketValue.send(JSON.stringify(payload));
    return true;
  }

  attachHubSocket(socket: SocketLike, handlers: {
    onOpen(): void;
    onMessage(message: unknown): void;
    onBadMessage(error: unknown, data: unknown): void;
    onClose(): void;
    onError(): void;
  }): void {
    this.socketValue = socket;
    this.hubModeValue = true;
    socket.onopen = handlers.onOpen;
    socket.onmessage = (event) => {
      try {
        handlers.onMessage(JSON.parse(String(event.data)));
      } catch (error) {
        handlers.onBadMessage(error, event.data);
      }
    };
    socket.onclose = handlers.onClose;
    socket.onerror = () => {
      handlers.onError();
      socket.close?.();
    };
  }

  attachNativeSocket(socket: SocketLike, handlers: {
    onOpen(): void;
    onNativePacket(buffer: ArrayBuffer): void;
    onJsonMessage(message: unknown): void;
    onBadMessage(error: unknown, data: unknown): void;
    onClose(): void;
    onError(): void;
  }): void {
    this.socketValue = socket;
    this.hubModeValue = false;
    socket.binaryType = "arraybuffer";
    socket.onopen = handlers.onOpen;
    socket.onmessage = (event) => {
      try {
        const data = event.data;
        if (data instanceof ArrayBuffer) {
          handlers.onNativePacket(data);
        } else if (typeof Blob !== "undefined" && data instanceof Blob) {
          data.arrayBuffer().then(handlers.onNativePacket);
        } else {
          handlers.onJsonMessage(JSON.parse(String(data)));
        }
      } catch (error) {
        handlers.onBadMessage(error, event.data);
      }
    };
    socket.onclose = handlers.onClose;
    socket.onerror = () => {
      handlers.onError();
      socket.close?.();
    };
  }

  startBroadcast(options: {
    setInterval: typeof setInterval;
    intervalMs: number;
    tick(): void;
  }): boolean {
    if (this.broadcastTimerValue) return false;
    this.broadcastTimerValue = options.setInterval.call(globalThis, options.tick, options.intervalMs);
    return true;
  }

  stopBroadcast(clearIntervalRef: typeof clearInterval): void {
    if (this.broadcastTimerValue) clearIntervalRef.call(globalThis, this.broadcastTimerValue);
    this.broadcastTimerValue = null;
  }

  holdBroadcastState(state: Record<string, unknown>, durationMs: number, now = performance.now()): void {
    this.broadcastOverrideValue = {
      state,
      until: now + Math.max(50, Math.min(5000, Number(durationMs) || 250))
    };
  }

  sendStateBurst(state: Record<string, unknown>, options: {
    count?: number;
    intervalMs?: number;
    setTimeoutRef?: typeof setTimeout;
    send(state: Record<string, unknown>): void;
  }): { total: number; intervalMs: number } {
    const total = Math.max(1, Math.min(12, Number(options.count) || 3));
    const intervalMs = Math.max(20, Math.min(250, Number(options.intervalMs) || 50));
    const setTimeoutRef = options.setTimeoutRef || setTimeout;
    for (let i = 0; i < total; i += 1) {
      setTimeoutRef.call(globalThis, () => options.send(state), i * intervalMs);
    }
    return { total, intervalMs };
  }

  runBroadcastTick<TState extends Record<string, unknown>>(options: {
    isOpen(): boolean;
    getCharacter(): unknown;
    buildState(character: unknown): TState | null;
    shouldBroadcast(state: TState): boolean;
    encode(state: TState): unknown;
    send(payload: unknown): void;
    now?: number;
  }): "closed" | "override" | "no-character" | "unchanged" | "sent" {
    if (!options.isOpen()) return "closed";
    const overrideState = this.consumeBroadcastOverride(options.now);
    if (overrideState) {
      options.send(overrideState);
      return "override";
    }
    const character = options.getCharacter();
    if (!character) return "no-character";
    const state = options.buildState(character);
    if (!state) return "no-character";
    if (!options.shouldBroadcast(state)) return "unchanged";
    options.send(options.encode(state));
    return "sent";
  }

  consumeBroadcastOverride(now = performance.now()): Record<string, unknown> | null {
    if (!this.broadcastOverrideValue) return null;
    if (now <= this.broadcastOverrideValue.until) return this.broadcastOverrideValue.state;
    this.broadcastOverrideValue = null;
    return null;
  }

  snapshot(): {
    connected: boolean;
    hubMode: boolean;
    connectFinished: boolean;
    hasLaunchInfo: boolean;
    animClock: number;
    broadcasting: boolean;
    hasBroadcastOverride: boolean;
  } {
    return {
      connected: Boolean(this.socketValue),
      hubMode: this.hubModeValue,
      connectFinished: this.connectFinishedValue,
      hasLaunchInfo: Boolean(this.launchInfoValue),
      animClock: this.animClockValue,
      broadcasting: Boolean(this.broadcastTimerValue),
      hasBroadcastOverride: Boolean(this.broadcastOverrideValue)
    };
  }

  reset(): void {
    this.socketValue = null;
    this.launchInfoValue = null;
    this.connectPromiseValue = null;
    this.connectFinishedValue = false;
    this.hubModeValue = false;
    this.animClockValue = 0;
    this.broadcastTimerValue = null;
    this.broadcastOverrideValue = null;
  }
}
