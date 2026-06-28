export type MovementConstants = {
  walkSpeed: number;
  jumpPower: number;
  gravity: number;
  rotationSpeed: number;
  stepHeight: number;
  stepClimbSpeed: number;
};

export type MovementMods = {
  fly: boolean;
  noclip: boolean;
  airwalk: boolean;
  gravityScale: number;
  flySpeed: number;
};

export type MovementModPatch = Partial<MovementMods>;

export type MovementModUpdate = {
  mods: MovementMods;
  shouldResetVerticalState: boolean;
};

export type MovementIntentInput = {
  left?: boolean;
  right?: boolean;
  forward?: boolean;
  backward?: boolean;
  yaw: number;
  speed: number;
};

export type MovementIntent = {
  moving: boolean;
  velocityX: number;
  velocityZ: number;
  targetAngle: number;
};

export type PlanarVelocityInput = {
  velocityX: number;
  velocityZ: number;
  extraVelX: number;
  extraVelZ: number;
  maxSpeed: number;
};

export type PlanarVelocity = {
  velocityX: number;
  velocityZ: number;
};

export type ExtraVelocity = {
  extraVelX: number;
  extraVelZ: number;
};

export type MovementVerticalState = ExtraVelocity & {
  velY: number;
  grounded: boolean;
  coyoteTimer: number;
  jumpBuffer: number;
};

export type PositionYTarget = {
  position: { y: number };
};

export type MovementKeyState = Record<string, boolean>;

const DEFAULT_CONSTANTS: MovementConstants = {
  walkSpeed: 16,
  jumpPower: 50,
  gravity: -196.2,
  rotationSpeed: 10,
  stepHeight: 1.4,
  stepClimbSpeed: 32
};

const DEFAULT_MODS: MovementMods = {
  fly: false,
  noclip: false,
  airwalk: false,
  gravityScale: 1,
  flySpeed: 28
};

export class MovementService {
  readonly constants: MovementConstants = { ...DEFAULT_CONSTANTS };
  private readonly mods: MovementMods = { ...DEFAULT_MODS };

  setMods(patch: MovementModPatch = {}): MovementModUpdate {
    if (patch.fly !== undefined) this.mods.fly = !!patch.fly;
    if (patch.noclip !== undefined) this.mods.noclip = !!patch.noclip;
    if (patch.airwalk !== undefined) this.mods.airwalk = !!patch.airwalk;
    if (patch.gravityScale !== undefined) {
      const scale = Number(patch.gravityScale);
      this.mods.gravityScale = Number.isFinite(scale) ? clamp(scale, 0, 8) : DEFAULT_MODS.gravityScale;
    }
    if (patch.flySpeed !== undefined) {
      const speed = Number(patch.flySpeed);
      this.mods.flySpeed = Number.isFinite(speed) ? clamp(speed, 2, 120) : DEFAULT_MODS.flySpeed;
    }
    return {
      mods: this.snapshotMods(),
      shouldResetVerticalState: this.mods.fly || this.mods.airwalk
    };
  }

  snapshotMods(): MovementMods {
    return { ...this.mods };
  }

  snapshotConstants(): MovementConstants {
    return { ...this.constants };
  }

  computePlanarIntent(input: MovementIntentInput): MovementIntent {
    const localX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const localZ = (input.backward ? 1 : 0) - (input.forward ? 1 : 0);
    const length = Math.sqrt(localX * localX + localZ * localZ);
    if (length <= 0) {
      return { moving: false, velocityX: 0, velocityZ: 0, targetAngle: 0 };
    }

    const x = localX / length;
    const z = localZ / length;
    const cos = Math.cos(input.yaw);
    const sin = Math.sin(input.yaw);
    const worldX = x * cos + z * sin;
    const worldZ = -x * sin + z * cos;
    return {
      moving: true,
      velocityX: worldX * input.speed,
      velocityZ: worldZ * input.speed,
      targetAngle: Math.atan2(worldX, worldZ)
    };
  }

  applyPlanarImpulse(input: PlanarVelocityInput): PlanarVelocity {
    let velocityX = input.velocityX + input.extraVelX;
    let velocityZ = input.velocityZ + input.extraVelZ;
    const speedSquared = velocityX * velocityX + velocityZ * velocityZ;
    if (speedSquared > input.maxSpeed * input.maxSpeed) {
      const scale = input.maxSpeed / Math.sqrt(speedSquared);
      velocityX *= scale;
      velocityZ *= scale;
    }
    return { velocityX, velocityZ };
  }

  decayExtraVelocity(input: ExtraVelocity & { dt: number; decayRate?: number; cutoff?: number }): ExtraVelocity {
    const decay = Math.max(0, 1 - (input.decayRate ?? 2.5) * input.dt);
    let extraVelX = input.extraVelX * decay;
    let extraVelZ = input.extraVelZ * decay;
    const cutoff = input.cutoff ?? 0.3;
    if (Math.abs(extraVelX) < cutoff) extraVelX = 0;
    if (Math.abs(extraVelZ) < cutoff) extraVelZ = 0;
    return { extraVelX, extraVelZ };
  }

  applyStepUp(input: {
    character: PositionYTarget;
    stepUpTarget: number;
    dt: number;
    stepClimbSpeed?: number;
    velY: number;
    grounded: boolean;
  }): Pick<MovementVerticalState, "velY" | "grounded"> {
    if (input.stepUpTarget <= input.character.position.y) {
      return { velY: input.velY, grounded: input.grounded };
    }
    const rise = Math.min(input.stepUpTarget - input.character.position.y, (input.stepClimbSpeed ?? this.constants.stepClimbSpeed) * input.dt);
    input.character.position.y += rise;
    return { velY: 0, grounded: true };
  }

  updateJumpWindows(input: {
    grounded: boolean;
    coyoteTimer: number;
    jumpBuffer: number;
    jumpPressed: boolean;
    dt: number;
    coyoteTime: number;
    jumpBufferWindow: number;
  }): Pick<MovementVerticalState, "coyoteTimer" | "jumpBuffer"> {
    const coyoteTimer = input.grounded ? input.coyoteTime : Math.max(0, input.coyoteTimer - input.dt);
    const buffered = input.jumpPressed
      ? input.jumpBufferWindow
      : Math.max(0, input.jumpBuffer - input.dt);
    return {
      coyoteTimer,
      jumpBuffer: buffered
    };
  }

  applyVerticalMode(input: {
    character: PositionYTarget;
    mods: MovementMods;
    keys: MovementKeyState;
    dt: number;
    state: MovementVerticalState;
  }): MovementVerticalState {
    const state = { ...input.state };
    if (input.mods.fly) {
      const vertical = (input.keys.Space ? 1 : 0) -
        ((input.keys.ShiftLeft || input.keys.ShiftRight || input.keys.ControlLeft || input.keys.ControlRight) ? 1 : 0);
      input.character.position.y += vertical * input.mods.flySpeed * input.dt;
      return { ...state, velY: 0, grounded: true, coyoteTimer: 0.12, jumpBuffer: 0 };
    }
    if (input.mods.airwalk) {
      return { ...state, velY: 0, grounded: true, coyoteTimer: 0.12, jumpBuffer: 0 };
    }

    const velY = state.velY + this.constants.gravity * input.mods.gravityScale * input.dt;
    input.character.position.y += velY * input.dt;
    return { ...state, velY, grounded: false };
  }

  consumeJump(input: {
    mods: MovementMods;
    state: MovementVerticalState;
    jumpPower?: number;
  }): Pick<MovementVerticalState, "velY" | "grounded" | "coyoteTimer" | "jumpBuffer"> {
    if (!input.mods.fly && !input.mods.airwalk && input.state.jumpBuffer > 0 && (input.state.grounded || input.state.coyoteTimer > 0)) {
      return {
        velY: input.jumpPower ?? this.constants.jumpPower,
        grounded: false,
        coyoteTimer: 0,
        jumpBuffer: 0
      };
    }
    return {
      velY: input.state.velY,
      grounded: input.state.grounded,
      coyoteTimer: input.state.coyoteTimer,
      jumpBuffer: input.state.jumpBuffer
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
