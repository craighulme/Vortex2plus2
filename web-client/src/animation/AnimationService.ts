export type FootIkConfig = {
  enabled: boolean;
  maxPelvisOffset: number;
  maxLegExtension: number;
  footProbeDistance: number;
  smoothing: number;
};

export type LegacyRemoteAnimation = "idle" | "walk" | "jump" | "climb" | string;

export type LegacyRemoteAnimationTarget = {
  anim?: LegacyRemoteAnimation;
  animTime?: number;
  meshes?: {
    bones?: Record<string, LegacyBoneLike | undefined>;
    rest?: Record<string, LegacyBoneRest | undefined>;
  };
};

export type LegacyBoneLike = {
  rotation: Record<string, number>;
  position: Record<string, number>;
  scale?: Record<string, number>;
};

export type LegacyBoneRest = {
  x?: number;
  y?: number;
  z?: number;
  px?: number;
  py?: number;
  pz?: number;
  sx?: number;
  sy?: number;
  sz?: number;
};

export type LocalAnimationState = {
  time: number;
  bones: Record<string, LegacyBoneLike | undefined>;
  rest: Record<string, LegacyBoneRest | undefined>;
};

export type LocalAnimationOptions = {
  dt: number;
  moving: boolean;
  grounded: boolean;
  climbing: boolean;
};

export type FootIkState = {
  leftY: number;
  rightY: number;
  pelvisY: number;
  leftGroundY: number | null;
  rightGroundY: number | null;
  active: boolean;
  axis: "y" | "z";
  leftScale: number;
  rightScale: number;
  maxLegExtension: number;
};

export type LocalFootIkOptions = {
  animation: LocalAnimationState;
  character: {
    position: { x: number; y: number; z: number };
    rotation: { y: number };
  } | null;
  physics: {
    snapshot?: () => { status?: string };
    castRay?: (origin: [number, number, number], direction: [number, number, number], distance: number) => { point?: [number, number, number] } | null;
  } | null | undefined;
  dt: number;
  moving: boolean;
  grounded: boolean;
  footOffset: number;
  charHeight: number;
};

export class AnimationService {
  private footIk: FootIkConfig = {
    enabled: false,
    maxPelvisOffset: 0.45,
    maxLegExtension: 1.35,
    footProbeDistance: 2.5,
    smoothing: 12
  };
  private readonly localFootIkState: FootIkState = createFootIkState();

  setFootIk(config: Partial<FootIkConfig>): void {
    const next = { ...this.footIk, ...config };
    next.enabled = Boolean(next.enabled && this.experimentalFootIkEnabled());
    this.footIk = next;
  }

  getFootIk(): FootIkConfig {
    return { ...this.footIk };
  }

  getFootIkState(): FootIkState {
    return { ...this.localFootIkState };
  }

  animateLocal(state: LocalAnimationState, options: LocalAnimationOptions): void {
    const dt = Math.max(0, Number(options.dt) || 0);
    state.time = Number(state.time || 0) + dt;
    const mode = options.climbing
      ? "climb"
      : !options.grounded
        ? "jump"
        : options.moving
          ? "walk"
          : "idle";
    animateLegacyPose(state.bones, state.rest, mode, state.time, dt, options.moving);
  }

  animateLegacyRemote(remote: LegacyRemoteAnimationTarget, dt: number): void {
    const bones = remote.meshes?.bones;
    const rest = remote.meshes?.rest;
    if (!bones || !rest) return;
    remote.animTime = Number(remote.animTime || 0) + dt;
    animateLegacyPose(bones, rest, remote.anim, remote.animTime, dt, true);
  }

  applyLocalFootIk(options: LocalFootIkOptions): FootIkState {
    const config = this.getFootIk();
    const physics = options.physics;
    const physicsReady = physics?.snapshot?.().status === "ready";
    const canRaycast = typeof physics?.castRay === "function";
    if (!options.character || !options.grounded || !config.enabled || !physicsReady || !canRaycast) {
      this.resetFootIk(options.animation, options.dt, config.smoothing);
      return this.getFootIkState();
    }

    const lLeg = options.animation.bones.Left_Leg;
    const rLeg = options.animation.bones.Right_Leg;
    const torso = options.animation.bones.Torso;
    if (!lLeg || !rLeg) return this.getFootIkState();

    const axis = footIkVerticalAxis(options.animation, lLeg, rLeg);
    const maxOffset = clamp(Number(config.maxLegExtension) || 1.35, 0, 2.5);
    const probe = clamp(Number(config.footProbeDistance) || 2.5, 1, 8);
    const smoothing = clamp(Number(config.smoothing) || 12, 1, 30);
    const moveBlend = options.moving ? 0.35 : 1;
    const footY = options.character.position.y - options.footOffset;

    const left = sampleFootGround(options.animation, options.character, lLeg, 0.9, footY, probe, physics, axis);
    const right = sampleFootGround(options.animation, options.character, rLeg, -0.9, footY, probe, physics, axis);
    const leftOffset = footIkGroundOffset(left, footY, maxOffset) * moveBlend;
    const rightOffset = footIkGroundOffset(right, footY, maxOffset) * moveBlend;
    const anchorOffset = Math.max(0, leftOffset, rightOffset);
    const leftTarget = clamp(leftOffset - anchorOffset, -maxOffset, 0);
    const rightTarget = clamp(rightOffset - anchorOffset, -maxOffset, 0);
    const alpha = Math.min(1, smoothing * options.dt);

    const state = this.localFootIkState;
    state.leftY = lerp(state.leftY, leftTarget, alpha);
    state.rightY = lerp(state.rightY, rightTarget, alpha);
    state.pelvisY = lerp(state.pelvisY, 0, alpha);
    state.leftGroundY = left.hit ? left.groundY : null;
    state.rightGroundY = right.hit ? right.groundY : null;
    state.active = Math.abs(state.leftY) > 0.01 || Math.abs(state.rightY) > 0.01 || Math.abs(state.pelvisY) > 0.01;
    state.axis = axis;
    state.maxLegExtension = maxOffset;
    state.leftScale = applyLegVerticalOffset(options.animation, lLeg, state.leftY, axis, options.charHeight);
    state.rightScale = applyLegVerticalOffset(options.animation, rLeg, state.rightY, axis, options.charHeight);
    if (torso) applyBoneVerticalOffset(options.animation, torso, state.pelvisY, axis);
    return this.getFootIkState();
  }

  private experimentalFootIkEnabled(): boolean {
    try {
      return globalThis.localStorage?.getItem("vwebExperimentalFootIk") === "1";
    } catch {
      return false;
    }
  }

  private resetFootIk(animation: LocalAnimationState, dt: number, smoothing = 12): void {
    const alpha = Math.min(1, Math.max(1, smoothing) * dt);
    const state = this.localFootIkState;
    state.leftY = lerp(state.leftY, 0, alpha);
    state.rightY = lerp(state.rightY, 0, alpha);
    state.pelvisY = lerp(state.pelvisY, 0, alpha);
    state.leftGroundY = null;
    state.rightGroundY = null;
    state.active = false;
    const axis = footIkVerticalAxis(animation, animation.bones.Left_Leg, animation.bones.Right_Leg);
    state.axis = axis;
    state.leftScale = applyLegVerticalOffset(animation, animation.bones.Left_Leg, state.leftY, axis, 5);
    state.rightScale = applyLegVerticalOffset(animation, animation.bones.Right_Leg, state.rightY, axis, 5);
    if (animation.bones.Torso) applyBoneVerticalOffset(animation, animation.bones.Torso, state.pelvisY, axis);
  }
}

function createFootIkState(): FootIkState {
  return {
    leftY: 0,
    rightY: 0,
    pelvisY: 0,
    leftGroundY: null,
    rightGroundY: null,
    active: false,
    axis: "y",
    leftScale: 1,
    rightScale: 1,
    maxLegExtension: 1.35
  };
}

function animateLegacyPose(
  bones: Record<string, LegacyBoneLike | undefined>,
  rest: Record<string, LegacyBoneRest | undefined>,
  animation: LegacyRemoteAnimation | undefined,
  time: number,
  dt: number,
  climbMoving: boolean
): void {
  const sp = 12;
  const t = Number(time || 0);

  if (animation === "climb") {
    const grip = climbMoving ? Math.sin(t * 6) * 0.15 : 0;
    const kick = climbMoving ? Math.sin(t * 6) * 0.3 : 0;
    setBoneRotation(bones, rest, "Left_Arm", "x", -Math.PI * 0.75 + grip, 10, dt);
    setBoneRotation(bones, rest, "Right_Arm", "x", -Math.PI * 0.75 - grip, 10, dt);
    setBoneRotation(bones, rest, "Left_Arm", "z", 0.35, 10, dt);
    setBoneRotation(bones, rest, "Right_Arm", "z", -0.35, 10, dt);
    setBoneRotation(bones, rest, "Left_Leg", "x", 0.3 + kick, 10, dt);
    setBoneRotation(bones, rest, "Right_Leg", "x", 0.3 - kick, 10, dt);
    setBoneRotation(bones, rest, "Torso", "x", -0.15, 10, dt);
    setBoneRotation(bones, rest, "Torso", "z", 0, 10, dt);
    setBonePositionY(bones, rest, "Left_Arm", 0.5, 10, dt);
    setBonePositionY(bones, rest, "Right_Arm", 0.5, 10, dt);
  } else if (animation === "jump") {
    setBoneRotation(bones, rest, "Left_Leg", "x", 0, sp, dt);
    setBoneRotation(bones, rest, "Right_Leg", "x", 0, sp, dt);
    setBoneRotation(bones, rest, "Left_Arm", "x", -Math.PI, sp, dt);
    setBoneRotation(bones, rest, "Right_Arm", "x", -Math.PI, sp, dt);
    setBoneRotation(bones, rest, "Left_Arm", "z", 0, sp, dt);
    setBoneRotation(bones, rest, "Right_Arm", "z", 0, sp, dt);
    setBoneRotation(bones, rest, "Torso", "x", 0, sp, dt);
    setBonePositionY(bones, rest, "Left_Arm", -0.75, sp, dt);
    setBonePositionY(bones, rest, "Right_Arm", -0.75, sp, dt);
  } else if (animation === "walk") {
    const swing = Math.sin(t * 2.8 * Math.PI);
    setBoneRotation(bones, rest, "Left_Leg", "x", swing * 1.0, sp, dt);
    setBoneRotation(bones, rest, "Right_Leg", "x", -swing * 1.0, sp, dt);
    setBoneRotation(bones, rest, "Left_Arm", "x", -swing * 0.8, sp, dt);
    setBoneRotation(bones, rest, "Right_Arm", "x", swing * 0.8, sp, dt);
    setBoneRotation(bones, rest, "Left_Arm", "z", 0.05, sp, dt);
    setBoneRotation(bones, rest, "Right_Arm", "z", -0.05, sp, dt);
    setBoneRotation(bones, rest, "Torso", "x", 0.03, sp, dt);
    setBoneRotation(bones, rest, "Torso", "z", 0, sp, dt);
    setBonePositionY(bones, rest, "Left_Arm", 0, sp, dt);
    setBonePositionY(bones, rest, "Right_Arm", 0, sp, dt);
  } else {
    const breathe = Math.sin(t * 1.2) * 0.015;
    setBoneRotation(bones, rest, "Left_Leg", "x", 0, sp, dt);
    setBoneRotation(bones, rest, "Right_Leg", "x", 0, sp, dt);
    setBoneRotation(bones, rest, "Left_Arm", "x", 0, sp, dt);
    setBoneRotation(bones, rest, "Right_Arm", "x", 0, sp, dt);
    setBoneRotation(bones, rest, "Left_Arm", "z", 0.1 + breathe, sp, dt);
    setBoneRotation(bones, rest, "Right_Arm", "z", -0.1 - breathe, sp, dt);
    setBoneRotation(bones, rest, "Torso", "x", breathe, sp, dt);
    setBoneRotation(bones, rest, "Torso", "z", 0, sp, dt);
    setBonePositionY(bones, rest, "Left_Arm", 0, sp, dt);
    setBonePositionY(bones, rest, "Right_Arm", 0, sp, dt);
  }
}

function setBoneRotation(
  bones: Record<string, LegacyBoneLike | undefined>,
  rest: Record<string, LegacyBoneRest | undefined>,
  name: string,
  axis: string,
  target: number,
  speed: number,
  dt: number
): void {
  const bone = bones[name];
  if (!bone) return;
  const restValue = Number(rest[name]?.[axis as keyof LegacyBoneRest] ?? 0);
  bone.rotation[axis] = lerp(Number(bone.rotation[axis] || 0), restValue + target, Math.min(1, speed * dt));
}

function setBonePositionY(
  bones: Record<string, LegacyBoneLike | undefined>,
  rest: Record<string, LegacyBoneRest | undefined>,
  name: string,
  offset: number,
  speed: number,
  dt: number
): void {
  const bone = bones[name];
  if (!bone) return;
  const restY = Number(rest[name]?.py ?? 0);
  bone.position.y = lerp(Number(bone.position.y || 0), restY + offset, Math.min(1, speed * dt));
}

function footIkGroundOffset(sample: { hit: boolean; groundY: number }, footY: number, maxOffset: number): number {
  if (!sample.hit) return 0;
  return clamp(sample.groundY - footY, -maxOffset, maxOffset);
}

function sampleFootGround(
  animation: LocalAnimationState,
  character: NonNullable<LocalFootIkOptions["character"]>,
  bone: LegacyBoneLike,
  fallbackLocalX: number,
  footY: number,
  probe: number,
  physics: NonNullable<LocalFootIkOptions["physics"]>,
  axis: "y" | "z"
): { hit: boolean; groundY: number; x: number; z: number } {
  const rest = animation.rest[readBoneName(animation, bone)] || {};
  const localX = Number.isFinite(rest.px) ? clamp(Number(rest.px), -1.15, 1.15) : fallbackLocalX;
  const forwardRest = axis === "z" ? rest.py : rest.pz;
  const localZ = Number.isFinite(forwardRest) ? clamp(Number(forwardRest), -1.15, 1.15) : 0;
  const yaw = character.rotation.y;
  const worldX = character.position.x + Math.cos(yaw) * localX + Math.sin(yaw) * localZ;
  const worldZ = character.position.z - Math.sin(yaw) * localX + Math.cos(yaw) * localZ;
  const hit = physics.castRay?.([worldX, footY + probe * 0.5, worldZ], [0, -1, 0], probe + 0.5) || null;
  return {
    hit: !!hit,
    groundY: hit?.point?.[1] ?? (footY - probe * 0.5),
    x: worldX,
    z: worldZ
  };
}

function footIkVerticalAxis(animation: LocalAnimationState, leftLeg: LegacyBoneLike | undefined, rightLeg: LegacyBoneLike | undefined): "y" | "z" {
  const left = leftLeg ? animation.rest[readBoneName(animation, leftLeg)] : null;
  const right = rightLeg ? animation.rest[readBoneName(animation, rightLeg)] : null;
  const zMagnitude = Math.max(Math.abs(left?.pz || 0), Math.abs(right?.pz || 0));
  const yMagnitude = Math.max(Math.abs(left?.py || 0), Math.abs(right?.py || 0));
  return zMagnitude > yMagnitude + 0.25 ? "z" : "y";
}

function applyBoneVerticalOffset(animation: LocalAnimationState, bone: LegacyBoneLike, offset: number, axis: "y" | "z"): void {
  const rest = animation.rest[readBoneName(animation, bone)] || {};
  const key = axis === "z" ? "pz" : "py";
  const restValue = Number.isFinite(rest[key]) ? Number(rest[key]) : Number(bone.position[axis] || 0);
  bone.position[axis] = restValue + offset;
}

function applyLegVerticalOffset(
  animation: LocalAnimationState,
  bone: LegacyBoneLike | undefined,
  offset: number,
  axis: "y" | "z",
  charHeight: number
): number {
  if (!bone) return 1;
  const rest = animation.rest[readBoneName(animation, bone)] || {};
  const positionKey = axis === "z" ? "pz" : "py";
  const scaleKey = axis === "z" ? "sz" : "sy";
  const restPosition = Number.isFinite(rest[positionKey]) ? Number(rest[positionKey]) : Number(bone.position[axis] || 0);
  const restScale = Number.isFinite(rest[scaleKey]) ? Number(rest[scaleKey]) : 1;
  const extension = Math.max(0, -offset);
  const legLength = clamp(Number(charHeight) * 0.4, 1, 3);
  const slide = clamp(-extension * 0.28, -legLength * 0.22, 0);
  bone.position[axis] = restPosition + slide;
  if (bone.scale) bone.scale[axis] = restScale;
  return restScale;
}

function readBoneName(animation: LocalAnimationState, bone: LegacyBoneLike): string {
  for (const [name, candidate] of Object.entries(animation.bones)) {
    if (candidate === bone) return name;
  }
  return "";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(current: number, target: number, alpha: number): number {
  return current + (target - current) * alpha;
}
