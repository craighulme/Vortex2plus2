export type LocalBroadcastState = {
  type?: "state";
  x: number;
  y: number;
  z: number;
  ry: number;
  anim: string;
};

export type LocalPlayerBroadcastInput = {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  moving: boolean;
  grounded: boolean;
  climbState: string;
  convertSceneYToNative: (sceneY: number) => number;
};

export class BroadcastStateTracker {
  private lastState: LocalBroadcastState | null = null;
  private lastSentAt = 0;

  shouldBroadcast(state: LocalBroadcastState, now = performance.now()): boolean {
    const changed = !this.lastState ||
      Math.abs(state.x - this.lastState.x) > BROADCAST_EPSILON ||
      Math.abs(state.y - this.lastState.y) > BROADCAST_EPSILON ||
      Math.abs(state.z - this.lastState.z) > BROADCAST_EPSILON ||
      Math.abs(state.ry - this.lastState.ry) > BROADCAST_EPSILON ||
      state.anim !== this.lastState.anim;
    const interval = changed ? ACTIVE_BROADCAST_MS : IDLE_BROADCAST_MS;
    if (now - this.lastSentAt < interval) return false;
    this.lastState = { ...state };
    this.lastSentAt = now;
    return true;
  }

  reset(): void {
    this.lastState = null;
    this.lastSentAt = 0;
  }
}

export function buildLocalBroadcastState(input: LocalPlayerBroadcastInput, normalizeYaw: (value: unknown) => number): LocalBroadcastState {
  return {
    type: "state",
    x: input.x,
    y: input.convertSceneYToNative(input.y),
    z: input.z,
    ry: normalizeYaw(input.rotationY),
    anim: input.climbState !== "none" ? "climb" : !input.grounded ? "jump" : input.moving ? "walk" : "idle"
  };
}

export function buildStateAtScenePosition(input: {
  position: VectorLike;
  rotationY: unknown;
  anim?: string;
  convertSceneYToNative: (sceneY: number) => number;
}, normalizeYaw: (value: unknown) => number): LocalBroadcastState {
  return {
    type: "state",
    x: Number(input.position.x || 0),
    y: input.convertSceneYToNative(Number(input.position.y || 0)),
    z: Number(input.position.z || 0),
    ry: normalizeYaw(input.rotationY),
    anim: input.anim || "idle"
  };
}

export function encodeNetworkState(data: LocalBroadcastState): LocalBroadcastState {
  const out: LocalBroadcastState = {
    x: data.x,
    y: data.y,
    z: data.z,
    ry: data.ry,
    anim: data.anim
  };
  if (data.type) out.type = data.type;
  return out;
}

type VectorLike = {
  x?: unknown;
  y?: unknown;
  z?: unknown;
};

const ACTIVE_BROADCAST_MS = 50;
const IDLE_BROADCAST_MS = 250;
const BROADCAST_EPSILON = 0.0025;
