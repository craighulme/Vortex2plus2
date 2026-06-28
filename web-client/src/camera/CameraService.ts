export type CameraState = {
  yaw: number;
  pitch: number;
  distance: number;
  minPitch: number;
  maxPitch: number;
  minDist: number;
  maxDist: number;
};

export type CameraTransform = {
  position: [number, number, number];
  pivot: [number, number, number];
  firstPerson: boolean;
};

export type CameraTransformOptions = {
  shiftLock: boolean;
  footOffset: number;
  pivotY?: number;
  referenceFootOffset?: number;
  shiftLockOffset?: number;
};

export type CameraPositionSource = {
  position: {
    x: number;
    y: number;
    z: number;
  };
};

export type CameraLockIntent = {
  firstPerson: boolean;
};

const BASE_SENSITIVITY = 0.0015 * Math.PI;
const CAMERA_PIVOT_Y = 2.56;
const CAMERA_REFERENCE_FOOT_OFFSET = 2.08;
const SHIFT_LOCK_OFFSET = 1.75;
const CAMERA_KEY_ZOOM_SPEED = 32;
const SNAP_STEP = Math.PI / 4;

export class CameraService {
  readonly state: CameraState = {
    yaw: 0,
    pitch: 0.35,
    distance: 25.6,
    minPitch: -1.55,
    maxPitch: 1.55,
    minDist: 2,
    maxDist: 512
  };

  private targetDistance = this.state.distance;
  private horizontalSensitivity = BASE_SENSITIVITY;
  private verticalSensitivity = BASE_SENSITIVITY;

  setSensitivity(multiplier: unknown): void {
    const value = Number(multiplier);
    const safeMultiplier = Number.isFinite(value) ? Math.max(0.05, Math.min(10, value)) : 1;
    this.horizontalSensitivity = BASE_SENSITIVITY * safeMultiplier;
    this.verticalSensitivity = BASE_SENSITIVITY * safeMultiplier;
  }

  pointerLook(movementX: number, movementY: number): void {
    this.state.yaw -= movementX * this.horizontalSensitivity;
    this.state.pitch = clamp(this.state.pitch + movementY * this.verticalSensitivity, this.state.minPitch, this.state.maxPitch);
  }

  snapYaw(direction: 1 | -1): void {
    this.state.yaw = Math.round((this.state.yaw + direction * SNAP_STEP) / SNAP_STEP) * SNAP_STEP;
  }

  zoomWheel(deltaY: number): CameraLockIntent {
    this.targetDistance = clamp(
      this.targetDistance * (1 + deltaY * 0.0005) + deltaY * 0.01,
      this.state.minDist,
      this.state.maxDist
    );
    return this.enforceFirstPersonTarget();
  }

  updateKeyboardZoom(dt: number, keys: Record<string, boolean>): CameraLockIntent | null {
    let changed = false;
    if (keys.KeyI) {
      this.targetDistance = Math.max(
        this.state.minDist,
        this.targetDistance * (1 - CAMERA_KEY_ZOOM_SPEED * dt * 0.05) - CAMERA_KEY_ZOOM_SPEED * dt * 0.9
      );
      changed = true;
    }
    if (keys.KeyO) {
      this.targetDistance = Math.min(
        this.state.maxDist,
        this.targetDistance * (1 + CAMERA_KEY_ZOOM_SPEED * dt * 0.05) + CAMERA_KEY_ZOOM_SPEED * dt * 0.9
      );
      changed = true;
    }
    return changed ? this.enforceFirstPersonTarget() : null;
  }

  updateYawKeys(dt: number, keys: Record<string, boolean>): void {
    if (keys.ArrowLeft) this.state.yaw += dt * 2;
    if (keys.ArrowRight) this.state.yaw -= dt * 2;
  }

  smoothDistance(alpha: number): void {
    this.state.distance = this.state.distance * (1 - alpha) + this.targetDistance * alpha;
  }

  computeTransform(character: CameraPositionSource, options: CameraTransformOptions): CameraTransform {
    const pivotY = options.pivotY ?? CAMERA_PIVOT_Y;
    const referenceFootOffset = options.referenceFootOffset ?? CAMERA_REFERENCE_FOOT_OFFSET;
    const shiftLockOffset = options.shiftLockOffset ?? SHIFT_LOCK_OFFSET;
    const sinYaw = Math.sin(this.state.yaw);
    const cosYaw = Math.cos(this.state.yaw);
    const sinPitch = Math.sin(this.state.pitch);
    const cosPitch = Math.cos(this.state.pitch);
    const pivot: [number, number, number] = [
      character.position.x,
      character.position.y + pivotY + referenceFootOffset - options.footOffset,
      character.position.z
    ];

    let cameraDistance = this.state.distance;
    const firstPerson = cameraDistance <= 2.001;
    if (firstPerson) {
      cameraDistance = 0.5;
      pivot[0] -= sinYaw;
      pivot[2] -= cosYaw;
    } else if (options.shiftLock) {
      pivot[0] += cosYaw * shiftLockOffset;
      pivot[2] += -sinYaw * shiftLockOffset;
    }

    return {
      pivot,
      position: [
        pivot[0] + cameraDistance * cosPitch * sinYaw,
        pivot[1] + cameraDistance * sinPitch,
        pivot[2] + cameraDistance * cosPitch * cosYaw
      ],
      firstPerson
    };
  }

  snapshot(): CameraState {
    return { ...this.state };
  }

  private enforceFirstPersonTarget(): CameraLockIntent {
    if (this.targetDistance < this.state.minDist) this.targetDistance = this.state.minDist;
    return { firstPerson: this.targetDistance <= this.state.minDist };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
