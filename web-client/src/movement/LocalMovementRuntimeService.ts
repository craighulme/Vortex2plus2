import type { AnimationService, LocalAnimationState } from "../animation/AnimationService";
import type { CameraService } from "../camera/CameraService";
import type { CursorService } from "../input/CursorService";
import type { PhysicsWorld } from "../physics/types";
import type { RuntimeSettingsStore } from "../runtime/RuntimeSettingsStore";
import type { CharacterCollisionService } from "./CharacterCollisionService";
import type { ClimbCollider, ClimbService } from "./ClimbService";
import type { MovementModPatch, MovementMods, MovementService } from "./MovementService";

type Vector3Like = {
  x: number;
  y: number;
  z: number;
  set?(x: number, y: number, z: number): void;
};

type CharacterLike = {
  position: Vector3Like;
  rotation: { y: number };
};

type CameraObjectLike = {
  position: Vector3Like;
  lookAt(target: unknown): void;
};

type CharacterSpawnLike = {
  getSpawn(): unknown;
  setSpawn(x: number, y: number, z: number, ry?: number): void;
  syncFromCandidate(candidate: unknown): void;
  applyToCharacter(character: CharacterLike | null, options: { footOffset: number; standY: number }): void;
};

type LocalAvatarLike = {
  setFirstPersonMode?(firstPerson: boolean, options: { hideBody: boolean }): void;
};

type LocalMovementRuntimeConfig = {
  movement: MovementService;
  collision: CharacterCollisionService;
  climb: ClimbService;
  animation: AnimationService;
  physics: PhysicsWorld | null | undefined;
  camera: CameraService;
  cursor: CursorService;
  localAvatar: LocalAvatarLike;
  settingsStore: RuntimeSettingsStore;
  keys: Record<string, boolean>;
  cameraObject: CameraObjectLike;
  cameraPivot: Vector3Like;
  anim: LocalAnimationState;
  characterSpawn: CharacterSpawnLike;
  windowRef: Window & { chooseSpawnPoint?: (map: unknown) => unknown; map?: unknown };
  getCharacter(): CharacterLike | null;
  getNearbyColliders(x: number, y: number, z: number): Iterable<ClimbCollider>;
  getMetrics(): {
    halfWidth: number;
    halfDepth: number;
    height: number;
    footOffset: number;
    standY: number;
  };
  setMouseLock(value: boolean): void;
  setFirstPerson(value: boolean): void;
};

export type LocalMovementRuntimeSnapshot = {
  velY: number;
  grounded: boolean;
  climbState: string;
  shiftLock: boolean;
  movementMods: MovementMods;
};

const COYOTE_TIME = 0.12;
const JUMP_BUFFER = 0.05;

export class LocalMovementRuntimeService {
  private config: LocalMovementRuntimeConfig | null = null;
  private velY = 0;
  private grounded = true;
  private stepUpTarget = -Infinity;
  private readonly pushedBlocks = new Set<unknown>();
  private shiftLock = false;
  private coyoteTimer = 0;
  private jumpBuffer = 0;
  private climbState = "none";
  private climbLedgeY = 0;
  private climbFwdX = 0;
  private climbFwdZ = 0;
  private climbBlock: ClimbCollider | null = null;
  private climbCooldown = 0;
  private extraVelX = 0;
  private extraVelZ = 0;
  private movementMods: MovementMods | null = null;

  configure(config: LocalMovementRuntimeConfig): this {
    this.config = config;
    this.movementMods = config.movement.snapshotMods();
    return this;
  }

  requestJump(): void {
    this.jumpBuffer = JUMP_BUFFER;
  }

  getShiftLock(): boolean {
    return this.shiftLock;
  }

  setShiftLock(value: boolean): void {
    this.shiftLock = !!value;
  }

  getGrounded(): boolean {
    return this.grounded;
  }

  setGrounded(value: unknown): void {
    this.grounded = !!value;
  }

  getVelY(): number {
    return this.velY;
  }

  setVelY(value: unknown): void {
    this.velY = Number(value) || 0;
  }

  getClimbState(): string {
    return this.climbState;
  }

  getMovementMods(): MovementMods {
    return this.requireConfig().movement.snapshotMods();
  }

  constants(): { WALK_SPEED: number; JUMP_POWER: number; GRAVITY: number } {
    const constants = this.requireConfig().movement.constants;
    return {
      WALK_SPEED: constants.walkSpeed,
      JUMP_POWER: constants.jumpPower,
      GRAVITY: constants.gravity
    };
  }

  setMovementMods(patch: MovementModPatch = {}): MovementMods {
    const config = this.requireConfig();
    const update = config.movement.setMods(patch);
    this.movementMods = update.mods;
    if (update.shouldResetVerticalState) {
      this.velY = 0;
      this.grounded = true;
      this.jumpBuffer = 0;
      this.climbState = "none";
    }
    return config.movement.snapshotMods();
  }

  snapshot(): LocalMovementRuntimeSnapshot {
    return {
      velY: this.velY,
      grounded: this.grounded,
      climbState: this.climbState,
      shiftLock: this.shiftLock,
      movementMods: this.getMovementMods()
    };
  }

  update(dt: number): void {
    const config = this.requireConfig();
    const character = config.getCharacter();
    if (!character) return;

    const movementMods = this.movementMods ?? config.movement.snapshotMods();
    const constants = config.movement.constants;
    const metrics = config.getMetrics();
    const safeDt = Math.min(dt, 0.05);

    const zoomIntent = config.camera.updateKeyboardZoom(safeDt, config.keys);
    if (zoomIntent) {
      config.setMouseLock(zoomIntent.firstPerson ? true : this.shiftLock);
    }
    config.camera.smoothDistance(safeDt * 20);

    const hanging = config.climb.updateHanging({
      state: this.climbRuntimeState(),
      dt: safeDt,
      keys: config.keys,
      character,
      camYaw: config.camera.state.yaw,
      mouseLookEnabled: config.cursor.mouseLookEnabled(),
      rotationSpeed: constants.rotationSpeed,
      footOffset: metrics.footOffset,
      dimensions: this.climbDimensions(metrics),
      getNearbyColliders: (x, y, z) => [...config.getNearbyColliders(x, y, z)]
    });
    if (hanging.handled) {
      this.applyClimbRuntimeState(hanging.state);
      this.updateClimbAnimation(safeDt, hanging.animationMoving);
      return;
    }

    const movementSpeed = (movementMods.fly || movementMods.noclip) ? movementMods.flySpeed : constants.walkSpeed;
    const intent = config.movement.computePlanarIntent({
      forward: Boolean(config.keys.KeyW || config.keys.ArrowUp),
      backward: Boolean(config.keys.KeyS || config.keys.ArrowDown),
      left: Boolean(config.keys.KeyA),
      right: Boolean(config.keys.KeyD),
      yaw: config.camera.state.yaw,
      speed: movementSpeed
    });
    const moving = intent.moving;
    if (movementMods.fly || movementMods.noclip || movementMods.airwalk) this.stepUpTarget = -Infinity;
    if (moving && !config.cursor.mouseLookEnabled()) {
      character.rotation.y = lerpAngle(character.rotation.y, intent.targetAngle, Math.min(1, constants.rotationSpeed * safeDt));
    }

    const planarVelocity = config.movement.applyPlanarImpulse({
      velocityX: intent.velocityX,
      velocityZ: intent.velocityZ,
      extraVelX: this.extraVelX,
      extraVelZ: this.extraVelZ,
      maxSpeed: movementSpeed
    });

    if (movementMods.noclip) {
      character.position.x += planarVelocity.velocityX * safeDt;
      character.position.z += planarVelocity.velocityZ * safeDt;
    } else {
      const nearby = [...config.getNearbyColliders(character.position.x, character.position.y, character.position.z)];
      const canStep = this.grounded || this.coyoteTimer > 0;
      const dimensions = this.collisionDimensions(metrics);
      const dx = config.collision.sweepAxisAligned({
        character,
        colliders: nearby,
        delta: planarVelocity.velocityX * safeDt,
        axis: "x",
        dimensions,
        stepHeight: constants.stepHeight,
        canStep,
        velY: this.velY
      });
      character.position.x += dx;

      const dz = config.collision.sweepAxisAligned({
        character,
        colliders: nearby,
        delta: planarVelocity.velocityZ * safeDt,
        axis: "z",
        dimensions,
        stepHeight: constants.stepHeight,
        canStep,
        velY: this.velY
      });
      character.position.z += dz;
    }

    ({ extraVelX: this.extraVelX, extraVelZ: this.extraVelZ } = config.movement.decayExtraVelocity({
      extraVelX: this.extraVelX,
      extraVelZ: this.extraVelZ,
      dt: safeDt
    }));

    if (config.cursor.mouseLookEnabled()) character.rotation.y = config.camera.state.yaw + Math.PI;

    this.climbCooldown = Math.max(0, this.climbCooldown - safeDt);

    ({ velY: this.velY, grounded: this.grounded } = config.movement.applyStepUp({
      character,
      stepUpTarget: this.stepUpTarget,
      dt: safeDt,
      stepClimbSpeed: constants.stepClimbSpeed,
      velY: this.velY,
      grounded: this.grounded
    }));

    const nearby = [...config.getNearbyColliders(character.position.x, character.position.y, character.position.z)];

    if (!movementMods.noclip) {
      const dimensions = this.collisionDimensions(metrics);
      this.stepUpTarget = -Infinity;
      this.pushedBlocks.clear();
      this.stepUpTarget = config.collision.resolveAxisAlignedHorizontal({
        character,
        colliders: nearby,
        dt: safeDt,
        dimensions,
        stepHeight: constants.stepHeight,
        stepClimbSpeed: constants.stepClimbSpeed,
        canStep: this.grounded || this.coyoteTimer > 0,
        velY: this.velY,
        stepUpTarget: this.stepUpTarget,
        pushedColliders: this.pushedBlocks as never
      });
      this.stepUpTarget = config.collision.resolveObbHorizontal({
        character,
        colliders: nearby,
        dt: safeDt,
        dimensions,
        stepHeight: constants.stepHeight,
        stepClimbSpeed: constants.stepClimbSpeed,
        canStep: this.grounded,
        velY: this.velY,
        stepUpTarget: this.stepUpTarget,
        pushedColliders: this.pushedBlocks as never
      });
      if (!movementMods.fly && !movementMods.airwalk && this.tryLedgeGrab(nearby)) {
        this.updateClimbAnimation(safeDt);
        return;
      }
    }

    ({ coyoteTimer: this.coyoteTimer, jumpBuffer: this.jumpBuffer } = config.movement.updateJumpWindows({
      grounded: this.grounded,
      coyoteTimer: this.coyoteTimer,
      jumpBuffer: this.jumpBuffer,
      jumpPressed: !!config.keys.Space,
      dt: safeDt,
      coyoteTime: COYOTE_TIME,
      jumpBufferWindow: JUMP_BUFFER
    }));

    this.applyCollisionState(config.movement.applyVerticalMode({
      character,
      mods: movementMods,
      keys: config.keys,
      dt: safeDt,
      state: this.collisionState()
    }));

    if (!movementMods.noclip) {
      const dimensions = this.collisionDimensions(metrics);
      this.applyCollisionState(config.collision.resolveAxisAlignedVertical({
        character,
        colliders: nearby,
        dt: safeDt,
        dimensions,
        stepClimbSpeed: constants.stepClimbSpeed,
        state: this.collisionState(),
        pushedColliders: this.pushedBlocks as never
      }));
      this.applyCollisionState(config.collision.resolveObbVertical({
        character,
        colliders: nearby,
        dt: safeDt,
        dimensions,
        stepClimbSpeed: constants.stepClimbSpeed,
        state: this.collisionState(),
        pushedColliders: this.pushedBlocks as never
      }));
    }

    ({ velY: this.velY, grounded: this.grounded, coyoteTimer: this.coyoteTimer, jumpBuffer: this.jumpBuffer } = config.movement.consumeJump({
      mods: movementMods,
      state: this.collisionState(),
      jumpPower: constants.jumpPower
    }));

    config.animation.animateLocal(config.anim, {
      dt: safeDt,
      moving,
      grounded: this.grounded,
      climbing: this.climbState !== "none"
    });
    this.applyRuntimeFootIk(safeDt, moving);
  }

  updateCamera(dt: number): void {
    const config = this.requireConfig();
    const character = config.getCharacter();
    if (!character) return;

    const metrics = config.getMetrics();
    config.camera.updateYawKeys(dt, config.keys);
    const transform = config.camera.computeTransform(character, {
      shiftLock: this.shiftLock,
      footOffset: metrics.footOffset
    });
    config.setFirstPerson(transform.firstPerson);
    config.localAvatar.setFirstPersonMode?.(transform.firstPerson, {
      hideBody: config.settingsStore.readFlag("vwebHideFirstPersonBody", true)
    });
    if (transform.firstPerson) config.setMouseLock(true);

    config.cameraPivot.set?.(transform.pivot[0], transform.pivot[1], transform.pivot[2]);
    config.cameraObject.position.set?.(transform.position[0], transform.position[1], transform.position[2]);
    config.cameraObject.lookAt(config.cameraPivot);
  }

  resetCharacterToSpawn(): boolean {
    const config = this.requireConfig();
    const character = config.getCharacter();
    if (!character) return false;
    if (typeof config.windowRef.chooseSpawnPoint === "function" && config.windowRef.map) {
      try {
        const spawn = config.windowRef.chooseSpawnPoint(config.windowRef.map);
        if (spawn) config.characterSpawn.syncFromCandidate(spawn);
      } catch {}
    }
    const metrics = config.getMetrics();
    config.characterSpawn.applyToCharacter(character, { footOffset: metrics.footOffset, standY: metrics.standY });
    this.velY = 0;
    this.grounded = false;
    this.coyoteTimer = 0;
    this.jumpBuffer = 0;
    this.extraVelX = 0;
    this.extraVelZ = 0;
    this.climbState = "none";
    this.climbBlock = null;
    return true;
  }

  private updateClimbAnimation(dt: number, moving = false): void {
    const config = this.requireConfig();
    config.animation.animateLocal(config.anim, { dt, moving: !!moving, grounded: true, climbing: true });
  }

  private applyRuntimeFootIk(dt: number, moving: boolean): void {
    const config = this.requireConfig();
    const character = config.getCharacter();
    const metrics = config.getMetrics();
    config.animation.applyLocalFootIk({
      animation: config.anim,
      character,
      physics: config.physics,
      dt,
      moving,
      grounded: this.grounded,
      footOffset: metrics.footOffset,
      charHeight: metrics.height
    });
  }

  private tryLedgeGrab(nearby: ClimbCollider[]): boolean {
    const config = this.requireConfig();
    const character = config.getCharacter();
    if (!character) return false;
    const metrics = config.getMetrics();
    const constants = config.movement.constants;
    const result = config.climb.tryLedgeGrab({
      nearby,
      keys: config.keys,
      climbCooldown: this.climbCooldown,
      climbState: this.climbState,
      grounded: this.grounded,
      velY: this.velY,
      character,
      footOffset: metrics.footOffset,
      stepHeight: constants.stepHeight,
      dimensions: this.climbDimensions(metrics)
    });
    if (!result) return false;
    this.climbLedgeY = result.ledgeY;
    this.climbBlock = result.block;
    this.climbFwdX = result.fwdX;
    this.climbFwdZ = result.fwdZ;
    this.climbState = result.climbState || "hanging";
    this.velY = 0;
    return true;
  }

  private collisionState() {
    return {
      velY: this.velY,
      grounded: this.grounded,
      coyoteTimer: this.coyoteTimer,
      jumpBuffer: this.jumpBuffer,
      extraVelX: this.extraVelX,
      extraVelZ: this.extraVelZ
    };
  }

  private applyCollisionState(state: {
    velY: number;
    grounded: boolean;
    coyoteTimer?: number;
    jumpBuffer?: number;
    extraVelX: number;
    extraVelZ: number;
  }): void {
    this.velY = state.velY;
    this.grounded = state.grounded;
    if (Number.isFinite(state.coyoteTimer)) this.coyoteTimer = Number(state.coyoteTimer);
    if (Number.isFinite(state.jumpBuffer)) this.jumpBuffer = Number(state.jumpBuffer);
    this.extraVelX = state.extraVelX;
    this.extraVelZ = state.extraVelZ;
  }

  private climbRuntimeState() {
    return {
      climbState: this.climbState,
      climbCooldown: this.climbCooldown,
      climbLedgeY: this.climbLedgeY,
      climbFwdX: this.climbFwdX,
      climbFwdZ: this.climbFwdZ,
      climbBlock: this.climbBlock,
      velY: this.velY,
      extraVelX: this.extraVelX,
      extraVelZ: this.extraVelZ,
      jumpBuffer: this.jumpBuffer
    };
  }

  private applyClimbRuntimeState(state: {
    climbState: string;
    climbCooldown: number;
    climbLedgeY: number;
    climbFwdX: number;
    climbFwdZ: number;
    climbBlock: ClimbCollider | null;
    velY: number;
    extraVelX: number;
    extraVelZ: number;
    jumpBuffer: number;
  }): void {
    this.climbState = state.climbState;
    this.climbCooldown = state.climbCooldown;
    this.climbLedgeY = state.climbLedgeY;
    this.climbFwdX = state.climbFwdX;
    this.climbFwdZ = state.climbFwdZ;
    this.climbBlock = state.climbBlock;
    this.velY = state.velY;
    this.extraVelX = state.extraVelX;
    this.extraVelZ = state.extraVelZ;
    this.jumpBuffer = state.jumpBuffer;
  }

  private collisionDimensions(metrics: ReturnType<LocalMovementRuntimeConfig["getMetrics"]>) {
    return {
      halfWidth: metrics.halfWidth,
      halfDepth: metrics.halfDepth,
      height: metrics.height,
      footOffset: metrics.footOffset
    };
  }

  private climbDimensions(metrics: ReturnType<LocalMovementRuntimeConfig["getMetrics"]>) {
    return {
      charHalfWidth: metrics.halfWidth,
      charHalfDepth: metrics.halfDepth,
      charHeight: metrics.height
    };
  }

  private requireConfig(): LocalMovementRuntimeConfig {
    if (!this.config) throw new Error("[movement] LocalMovementRuntimeService is not configured.");
    return this.config;
  }
}

function lerpAngle(current: number, target: number, t: number): number {
  let diff = target - current;
  diff = ((diff % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  return current + diff * t;
}
