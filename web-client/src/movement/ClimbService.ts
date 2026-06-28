export type ClimbState = "none" | "hanging" | string;

export type ClimbConstants = {
  riseSpeed: number;
  sideSpeed: number;
  reach: number;
  fallCutoff: number;
  maxPartHeight: number;
  window: number;
  jumpUp: number;
  jumpBackSpeed: number;
  hangDepth: number;
};

export type ClimbDimensions = {
  charHalfWidth: number;
  charHalfDepth: number;
  charHeight: number;
};

export type ClimbCollider = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  shape?: string;
  partType?: string;
  climbable?: boolean;
};

export type ClimbableBlockOptions = {
  currentBlock?: ClimbCollider | null;
  px: number;
  pz: number;
  footY: number;
  fwdX: number;
  fwdZ: number;
  dimensions: ClimbDimensions;
  getNearbyColliders(x: number, y: number, z: number): ClimbCollider[];
};

export type ChainBlockOptions = {
  colliders: ClimbCollider[];
  px: number;
  pz: number;
  ledgeY: number;
  fwdX: number;
  fwdZ: number;
  dimensions: Pick<ClimbDimensions, "charHalfWidth">;
};

export type LedgeGrabOptions = {
  nearby: ClimbCollider[];
  keys: Record<string, boolean>;
  climbCooldown: number;
  climbState: ClimbState;
  grounded: boolean;
  velY: number;
  character: {
    position: { x: number; y: number; z: number };
    rotation: { y: number };
  };
  footOffset: number;
  stepHeight: number;
  dimensions: ClimbDimensions;
};

export type LedgeGrabResult = {
  block: ClimbCollider;
  ledgeY: number;
  fwdX: number;
  fwdZ: number;
  climbState?: ClimbState;
};

export type HangingClimbState = {
  climbState: ClimbState;
  climbCooldown: number;
  climbLedgeY: number;
  climbFwdX: number;
  climbFwdZ: number;
  climbBlock: ClimbCollider | null;
  velY: number;
  extraVelX: number;
  extraVelZ: number;
  jumpBuffer: number;
};

export type HangingClimbOptions = {
  state: HangingClimbState;
  dt: number;
  keys: Record<string, boolean>;
  character: {
    position: { x: number; y: number; z: number };
    rotation: { y: number };
  };
  camYaw: number;
  mouseLookEnabled: boolean;
  rotationSpeed: number;
  footOffset: number;
  dimensions: ClimbDimensions;
  getNearbyColliders(x: number, y: number, z: number): ClimbCollider[];
};

export type HangingClimbResult = {
  handled: boolean;
  state: HangingClimbState;
  animationMoving: boolean;
};

const DEFAULT_CONSTANTS: ClimbConstants = {
  riseSpeed: 11.2,
  sideSpeed: 11.2,
  reach: 0.1,
  fallCutoff: -200,
  maxPartHeight: 1.5,
  window: 2.2,
  jumpUp: 38,
  jumpBackSpeed: 14,
  hangDepth: 1.2
};

export class ClimbService {
  readonly constants: ClimbConstants = { ...DEFAULT_CONSTANTS };

  findClimbableBlock(options: ClimbableBlockOptions): ClimbCollider | null {
    const { currentBlock, px, pz, footY, fwdX, fwdZ, dimensions } = options;
    if (currentBlock && this.isStillClimbable(currentBlock, px, pz, footY, dimensions)) {
      return currentBlock;
    }

    const nearby = options.getNearbyColliders(px, footY + dimensions.charHeight / 2, pz);
    let best: ClimbCollider | null = null;
    let bestScore = Infinity;
    for (const block of nearby) {
      if (!this.canUseTallClimbSurface(block) && block.maxY - block.minY > this.constants.maxPartHeight) continue;
      if (block.maxY < footY - this.constants.hangDepth - 0.1) continue;
      if (block.minY > footY + dimensions.charHeight) continue;

      const point = closestPoint2d(block, px, pz);
      const dx = point.x - px;
      const dz = point.z - pz;
      const distance = Math.sqrt(dx * dx + dz * dz);
      if (distance > dimensions.charHalfWidth + this.constants.reach + 0.4) continue;
      if (distance >= 0.01 && (dx / distance) * fwdX + (dz / distance) * fwdZ < -0.5) continue;

      const score = distance + Math.abs(block.maxY - footY) * 0.1;
      if (score < bestScore) {
        bestScore = score;
        best = block;
      }
    }
    return best;
  }

  findChainBlockBelow(options: ChainBlockOptions): ClimbCollider | null {
    let best: ClimbCollider | null = null;
    let bestY = -Infinity;
    for (const block of options.colliders) {
      if (!this.canUseTallClimbSurface(block) && block.maxY - block.minY > this.constants.maxPartHeight) continue;
      if (block.maxY >= options.ledgeY - 0.01) continue;
      if (block.maxY < options.ledgeY - this.constants.window) continue;
      const point = closestPoint2d(block, options.px, options.pz);
      const dx = point.x - options.px;
      const dz = point.z - options.pz;
      const distance = Math.sqrt(dx * dx + dz * dz);
      if (distance > options.dimensions.charHalfWidth + this.constants.reach + 0.4) continue;
      if (block.maxY > bestY) {
        best = block;
        bestY = block.maxY;
      }
    }
    return best;
  }

  findChainBlockAbove(options: ChainBlockOptions): ClimbCollider | null {
    for (const block of options.colliders) {
      if (!this.canUseTallClimbSurface(block) && block.maxY - block.minY > this.constants.maxPartHeight) continue;
      if (block.maxY <= options.ledgeY + 0.01 || block.maxY > options.ledgeY + this.constants.window) continue;
      const dx = (block.minX + block.maxX) * 0.5 - options.px;
      const dz = (block.minZ + block.maxZ) * 0.5 - options.pz;
      const distance = Math.sqrt(dx * dx + dz * dz);
      if (distance > 0.01 && (dx / distance) * options.fwdX + (dz / distance) * options.fwdZ < 0.4) continue;
      return block;
    }
    return null;
  }

  tryLedgeGrab(options: LedgeGrabOptions): LedgeGrabResult | null {
    if (options.climbCooldown > 0 || options.climbState !== "none") {
      return null;
    }
    if ((options.keys.KeyS || options.keys.ArrowDown) && !(options.keys.KeyW || options.keys.ArrowUp)) return null;

    const footY = options.character.position.y - options.footOffset;
    const px = options.character.position.x;
    const pz = options.character.position.z;
    const fwdX = Math.sin(options.character.rotation.y);
    const fwdZ = Math.cos(options.character.rotation.y);
    const truss = this.findTrussStart({
      nearby: options.nearby,
      px,
      pz,
      footY,
      fwdX,
      fwdZ,
      dimensions: options.dimensions
    });
    if (truss) return truss;

    if (options.grounded || options.velY < this.constants.fallCutoff) return null;

    let bestBlock: ClimbCollider | null = null;
    let bestFwdX = 0;
    let bestFwdZ = 0;
    let bestDistance = Infinity;

    for (const block of options.nearby) {
      if (!this.canUseTallClimbSurface(block) && block.maxY - block.minY > this.constants.maxPartHeight) continue;
      const below = block.maxY - footY;
      if (below <= options.stepHeight || below > this.constants.window) continue;
      if (block.minY > footY + options.dimensions.charHeight) continue;

      const ox = Math.min(px + options.dimensions.charHalfWidth + this.constants.reach, block.maxX) -
        Math.max(px - options.dimensions.charHalfWidth - this.constants.reach, block.minX);
      const oz = Math.min(pz + options.dimensions.charHalfDepth + this.constants.reach, block.maxZ) -
        Math.max(pz - options.dimensions.charHalfDepth - this.constants.reach, block.minZ);
      if (ox <= 0 || oz <= 0) continue;

      const point = closestPoint2d(block, px, pz);
      let apX = point.x - px;
      let apZ = point.z - pz;
      const distance = Math.sqrt(apX * apX + apZ * apZ);
      if (distance < 0.01) {
        apX = fwdX;
        apZ = fwdZ;
      } else {
        apX /= distance;
        apZ /= distance;
        if (apX * fwdX + apZ * fwdZ < -0.9) continue;
      }

      if (distance < bestDistance) {
        bestDistance = distance;
        bestBlock = block;
        bestFwdX = apX;
        bestFwdZ = apZ;
      }
    }

    return bestBlock ? { block: bestBlock, ledgeY: bestBlock.maxY, fwdX: bestFwdX, fwdZ: bestFwdZ } : null;
  }

  updateHanging(options: HangingClimbOptions): HangingClimbResult {
    const state: HangingClimbState = { ...options.state };
    if (state.climbState !== "hanging" && state.climbState !== "truss") {
      return { handled: false, state, animationMoving: false };
    }

    const { character, dimensions } = options;
    let footY = character.position.y - options.footOffset;
    const stillValid = this.findClimbableBlock({
      currentBlock: state.climbBlock,
      px: character.position.x,
      pz: character.position.z,
      footY,
      fwdX: state.climbFwdX,
      fwdZ: state.climbFwdZ,
      dimensions,
      getNearbyColliders: options.getNearbyColliders
    });
    if (!stillValid) {
      state.climbState = "none";
      state.climbCooldown = 0.25;
      return { handled: true, state, animationMoving: false };
    }

    state.climbBlock = stillValid;
    if (state.climbState !== "truss") state.climbLedgeY = stillValid.maxY;

    if (options.mouseLookEnabled) {
      const grabAngle = Math.atan2(state.climbFwdX, state.climbFwdZ);
      const camAngle = options.camYaw + Math.PI;
      const diff = normalizeAngle(camAngle - grabAngle);
      if (Math.abs(diff) > Math.PI / 4) {
        state.climbState = "none";
        state.climbCooldown = 0.25;
        state.velY = 0;
        return { handled: true, state, animationMoving: false };
      }
      character.rotation.y = options.camYaw + Math.PI;
    } else {
      const faceAngle = Math.atan2(state.climbFwdX, state.climbFwdZ);
      character.rotation.y = lerpAngle(character.rotation.y, faceAngle, Math.min(1, options.rotationSpeed * options.dt));
    }

    if (state.jumpBuffer > 0) {
      state.velY = this.constants.jumpUp;
      state.extraVelX = -state.climbFwdX * this.constants.jumpBackSpeed;
      state.extraVelZ = -state.climbFwdZ * this.constants.jumpBackSpeed;
      state.climbState = "none";
      state.climbCooldown = 0;
      state.jumpBuffer = 0;
      return { handled: true, state, animationMoving: false };
    }

    const pressW = !!(options.keys.KeyW || options.keys.ArrowUp);
    const pressS = !!(options.keys.KeyS || options.keys.ArrowDown);
    const rawVert = (pressW ? 1 : 0) - (pressS ? 1 : 0);
    const animationMoving = rawVert !== 0;

    state.velY = 0;
    character.position.y += rawVert * this.constants.riseSpeed * options.dt;
    footY = character.position.y - options.footOffset;

    if (state.climbState === "truss") {
      if (rawVert < 0 && footY < stillValid.minY - 0.05) {
        state.climbState = "none";
        state.climbCooldown = 0.1;
        state.velY = -2;
        return { handled: true, state, animationMoving: false };
      }
      if (rawVert > 0 && footY >= stillValid.maxY) {
        character.position.x += state.climbFwdX * 0.4;
        character.position.z += state.climbFwdZ * 0.4;
        state.climbState = "none";
        state.velY = 2;
        return { handled: true, state, animationMoving: false };
      }
      state.climbLedgeY = clamp(footY + this.constants.hangDepth, stillValid.minY + this.constants.hangDepth, stillValid.maxY);
      return { handled: true, state, animationMoving };
    }

    if (rawVert < 0 && footY < state.climbLedgeY - this.constants.hangDepth) {
      const belowBlock = this.findChainBlockBelow({
        colliders: options.getNearbyColliders(character.position.x, state.climbLedgeY, character.position.z),
        px: character.position.x,
        pz: character.position.z,
        ledgeY: state.climbLedgeY,
        fwdX: state.climbFwdX,
        fwdZ: state.climbFwdZ,
        dimensions: { charHalfWidth: dimensions.charHalfWidth }
      });
      if (belowBlock) {
        state.climbBlock = belowBlock;
        state.climbLedgeY = belowBlock.maxY;
      } else {
        state.climbState = "none";
        state.climbCooldown = 0.1;
        state.velY = -2;
        return { handled: true, state, animationMoving: false };
      }
    }

    footY = character.position.y - options.footOffset;
    if (footY >= state.climbLedgeY) {
      const chainBlock = this.findChainBlockAbove({
        colliders: options.getNearbyColliders(character.position.x, state.climbLedgeY, character.position.z),
        px: character.position.x,
        pz: character.position.z,
        ledgeY: state.climbLedgeY,
        fwdX: state.climbFwdX,
        fwdZ: state.climbFwdZ,
        dimensions: { charHalfWidth: dimensions.charHalfWidth }
      });
      if (chainBlock) {
        state.climbBlock = chainBlock;
        state.climbLedgeY = chainBlock.maxY;
      } else if (rawVert > 0.3) {
        character.position.x += state.climbFwdX * 0.4;
        character.position.z += state.climbFwdZ * 0.4;
        state.climbState = "none";
        state.velY = 2;
        return { handled: true, state, animationMoving: false };
      } else {
        character.position.y = state.climbLedgeY + options.footOffset;
      }
    }

    if (!animationMoving) {
      const hangY = state.climbLedgeY - this.constants.hangDepth + options.footOffset;
      const stillAtTop = !this.findChainBlockAbove({
        colliders: options.getNearbyColliders(character.position.x, state.climbLedgeY, character.position.z),
        px: character.position.x,
        pz: character.position.z,
        ledgeY: state.climbLedgeY,
        fwdX: state.climbFwdX,
        fwdZ: state.climbFwdZ,
        dimensions: { charHalfWidth: dimensions.charHalfWidth }
      });
      if (stillAtTop && character.position.y > hangY) {
        const drop = Math.min(this.constants.riseSpeed * 2 * options.dt, character.position.y - hangY);
        character.position.y -= drop;
      }
    }

    return { handled: true, state, animationMoving };
  }

  private isStillClimbable(block: ClimbCollider, px: number, pz: number, footY: number, dimensions: ClimbDimensions): boolean {
    if (!this.canUseTallClimbSurface(block) && block.maxY - block.minY > this.constants.maxPartHeight) return false;
    if (block.maxY < footY - this.constants.hangDepth - 0.1) return false;
    if (block.minY > footY + dimensions.charHeight) return false;
    const point = closestPoint2d(block, px, pz);
    const dx = point.x - px;
    const dz = point.z - pz;
    const distance = Math.sqrt(dx * dx + dz * dz);
    return distance <= dimensions.charHalfWidth + this.constants.reach + 0.4;
  }

  private canUseTallClimbSurface(block: ClimbCollider): boolean {
    return block.climbable === true || /truss/i.test(block.shape || "") || /truss/i.test(block.partType || "");
  }

  private findTrussStart(options: {
    nearby: ClimbCollider[];
    px: number;
    pz: number;
    footY: number;
    fwdX: number;
    fwdZ: number;
    dimensions: ClimbDimensions;
  }): LedgeGrabResult | null {
    let best: LedgeGrabResult | null = null;
    let bestDistance = Infinity;
    for (const block of options.nearby) {
      if (!this.canUseTallClimbSurface(block)) continue;
      if (block.maxY < options.footY + 0.2) continue;
      if (block.minY > options.footY + options.dimensions.charHeight) continue;
      const point = closestPoint2d(block, options.px, options.pz);
      let dx = point.x - options.px;
      let dz = point.z - options.pz;
      const distance = Math.sqrt(dx * dx + dz * dz);
      if (distance > options.dimensions.charHalfWidth + this.constants.reach + 0.6) continue;
      if (distance < 0.01) {
        dx = options.fwdX;
        dz = options.fwdZ;
      } else {
        dx /= distance;
        dz /= distance;
        if (dx * options.fwdX + dz * options.fwdZ < -0.25) continue;
      }
      if (distance >= bestDistance) continue;
      bestDistance = distance;
      best = {
        block,
        ledgeY: clamp(options.footY + this.constants.hangDepth, block.minY + this.constants.hangDepth, block.maxY),
        fwdX: dx,
        fwdZ: dz,
        climbState: "truss"
      };
    }
    return best;
  }
}

function lerpAngle(current: number, target: number, t: number): number {
  return current + normalizeAngle(target - current) * t;
}

function normalizeAngle(angle: number): number {
  return ((angle % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function closestPoint2d(block: ClimbCollider, px: number, pz: number): { x: number; z: number } {
  return {
    x: Math.max(block.minX, Math.min(px, block.maxX)),
    z: Math.max(block.minZ, Math.min(pz, block.maxZ))
  };
}
