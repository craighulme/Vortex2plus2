export type CharacterCollisionDimensions = {
  halfWidth: number;
  halfDepth: number;
  height: number;
  footOffset: number;
};

export type CharacterCollisionPose = {
  position: { x: number; y: number; z: number };
  rotation: { y: number };
};

export type AxisAlignedCollider = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

export type CharacterCollider = AxisAlignedCollider & Partial<OrientedCollider> & {
  isOBB?: boolean;
};

export type OrientedCollider = AxisAlignedCollider & {
  cx: number;
  cy: number;
  cz: number;
  hx: number;
  hy: number;
  hz: number;
  ux: number;
  uy: number;
  uz: number;
  vx: number;
  vy: number;
  vz: number;
  wx: number;
  wy: number;
  wz: number;
};

export type PlanarOverlap = {
  ov0: number;
  ov1: number;
  ov2: number;
  ov3: number;
  dx: number;
  dz: number;
  dp2: number;
  dp3: number;
  co: number;
  si: number;
};

export type MinimumTranslationVector = {
  nx: number;
  ny: number;
  nz: number;
  depth: number;
};

export type CollisionMotionState = {
  velY: number;
  grounded: boolean;
  extraVelX: number;
  extraVelZ: number;
};

export type HorizontalResolveOptions = {
  character: CharacterCollisionPose;
  colliders: CharacterCollider[];
  dt: number;
  dimensions: CharacterCollisionDimensions;
  stepHeight: number;
  stepClimbSpeed: number;
  canStep: boolean;
  velY: number;
  stepUpTarget: number;
  pushedColliders: Set<CharacterCollider>;
};

export type VerticalResolveOptions = {
  character: CharacterCollisionPose;
  colliders: CharacterCollider[];
  dt: number;
  dimensions: CharacterCollisionDimensions;
  stepClimbSpeed: number;
  state: CollisionMotionState;
  pushedColliders: Set<CharacterCollider>;
};

export type AxisSweepOptions = {
  character: CharacterCollisionPose;
  colliders: CharacterCollider[];
  delta: number;
  axis: "x" | "z";
  dimensions: CharacterCollisionDimensions;
  stepHeight: number;
  canStep: boolean;
  velY: number;
};

export class CharacterCollisionService {
  planarOverlap(
    cx: number,
    cz: number,
    co: number,
    si: number,
    collider: AxisAlignedCollider,
    dimensions: Pick<CharacterCollisionDimensions, "halfWidth" | "halfDepth">
  ): PlanarOverlap | null {
    const aco = Math.abs(co);
    const asi = Math.abs(si);
    const bcx = (collider.minX + collider.maxX) * 0.5;
    const bcz = (collider.minZ + collider.maxZ) * 0.5;
    const bhx = (collider.maxX - collider.minX) * 0.5;
    const bhz = (collider.maxZ - collider.minZ) * 0.5;
    const dx = bcx - cx;
    const dz = bcz - cz;

    const ov0 = (dimensions.halfWidth * aco + dimensions.halfDepth * asi) + bhx - Math.abs(dx);
    if (ov0 <= 0) return null;

    const ov1 = (dimensions.halfWidth * asi + dimensions.halfDepth * aco) + bhz - Math.abs(dz);
    if (ov1 <= 0) return null;

    const dp2 = dx * co - dz * si;
    const ov2 = dimensions.halfWidth + (bhx * aco + bhz * asi) - Math.abs(dp2);
    if (ov2 <= 0) return null;

    const dp3 = dx * si + dz * co;
    const ov3 = dimensions.halfDepth + (bhx * asi + bhz * aco) - Math.abs(dp3);
    if (ov3 <= 0) return null;

    return { ov0, ov1, ov2, ov3, dx, dz, dp2, dp3, co, si };
  }

  mtvObbVsCharacter(
    character: CharacterCollisionPose,
    collider: OrientedCollider,
    dimensions: CharacterCollisionDimensions
  ): MinimumTranslationVector | null {
    const px = character.position.x;
    const py = character.position.y - dimensions.footOffset + dimensions.height / 2;
    const pz = character.position.z;
    const phx = dimensions.halfWidth;
    const phy = dimensions.height / 2;
    const phz = dimensions.halfDepth;
    const cy = Math.cos(character.rotation.y);
    const sy = Math.sin(character.rotation.y);
    const cux = cy;
    const cuy = 0;
    const cuz = -sy;
    const cvx = 0;
    const cvy = 1;
    const cvz = 0;
    const cwx = sy;
    const cwy = 0;
    const cwz = cy;
    const dx = px - collider.cx;
    const dy = py - collider.cy;
    const dz = pz - collider.cz;
    let minOv = Infinity;
    let nx = 0;
    let ny = 0;
    let nz = 0;

    const testAxis = (ax0: number, ay0: number, az0: number): boolean => {
      let ax = ax0;
      let ay = ay0;
      let az = az0;
      const len = Math.sqrt(ax * ax + ay * ay + az * az);
      if (len < 1e-8) return true;
      ax /= len;
      ay /= len;
      az /= len;
      const charR =
        phx * Math.abs(ax * cux + ay * cuy + az * cuz) +
        phy * Math.abs(ax * cvx + ay * cvy + az * cvz) +
        phz * Math.abs(ax * cwx + ay * cwy + az * cwz);
      const obbR =
        collider.hx * Math.abs(ax * collider.ux + ay * collider.uy + az * collider.uz) +
        collider.hy * Math.abs(ax * collider.vx + ay * collider.vy + az * collider.vz) +
        collider.hz * Math.abs(ax * collider.wx + ay * collider.wy + az * collider.wz);
      const sep = Math.abs(dx * ax + dy * ay + dz * az);
      const ov = charR + obbR - sep;
      if (ov <= 0) return false;
      if (ov < minOv) {
        minOv = ov;
        nx = ax;
        ny = ay;
        nz = az;
      }
      return true;
    };

    if (!testAxis(cux, cuy, cuz)) return null;
    if (!testAxis(cvx, cvy, cvz)) return null;
    if (!testAxis(cwx, cwy, cwz)) return null;
    if (!testAxis(collider.ux, collider.uy, collider.uz)) return null;
    if (!testAxis(collider.vx, collider.vy, collider.vz)) return null;
    if (!testAxis(collider.wx, collider.wy, collider.wz)) return null;

    const charAxes: Array<[number, number, number]> = [
      [cux, cuy, cuz],
      [cvx, cvy, cvz],
      [cwx, cwy, cwz]
    ];
    const obbAxes: Array<[number, number, number]> = [
      [collider.ux, collider.uy, collider.uz],
      [collider.vx, collider.vy, collider.vz],
      [collider.wx, collider.wy, collider.wz]
    ];
    for (const [ax, ay, az] of charAxes) {
      for (const [bx, by, bz] of obbAxes) {
        const cx = ay * bz - az * by;
        const cy2 = az * bx - ax * bz;
        const cz = ax * by - ay * bx;
        if (!testAxis(cx, cy2, cz)) return null;
      }
    }

    if (dx * nx + dy * ny + dz * nz < 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    return { nx, ny, nz, depth: minOv };
  }

  sweepAxisAligned(options: AxisSweepOptions): number {
    if (options.delta === 0) return 0;
    const { character, dimensions } = options;
    const footY = character.position.y - dimensions.footOffset;
    const { halfX, halfZ } = this.characterHalfExtents(character.rotation.y, dimensions);
    let delta = options.delta;

    for (const collider of options.colliders) {
      if (collider.isOBB) continue;
      if (collider.maxY <= footY || collider.minY >= footY + dimensions.height) continue;
      const stepNeeded = collider.maxY - footY;
      if (stepNeeded > 0 && stepNeeded <= options.stepHeight && options.canStep && options.velY <= 0) continue;
      if (options.axis === "x") {
        if (character.position.z + halfZ <= collider.minZ || character.position.z - halfZ >= collider.maxZ) continue;
        delta = clampAxisDelta(delta, character.position.x, halfX, collider.minX, collider.maxX);
      } else {
        if (character.position.x + halfX <= collider.minX || character.position.x - halfX >= collider.maxX) continue;
        delta = clampAxisDelta(delta, character.position.z, halfZ, collider.minZ, collider.maxZ);
      }
    }

    return delta;
  }

  resolveAxisAlignedHorizontal(options: HorizontalResolveOptions): number {
    const { character, dimensions } = options;
    const footY = character.position.y - dimensions.footOffset;
    const co = Math.cos(character.rotation.y);
    const si = Math.sin(character.rotation.y);
    const { halfX, halfZ } = this.characterHalfExtents(character.rotation.y, dimensions);
    let stepUpTarget = options.stepUpTarget;

    for (const collider of options.colliders) {
      if (collider.isOBB) continue;
      if (collider.maxY <= footY || collider.minY >= footY + dimensions.height) continue;
      if (character.position.x + halfX <= collider.minX || character.position.x - halfX >= collider.maxX) continue;
      if (character.position.z + halfZ <= collider.minZ || character.position.z - halfZ >= collider.maxZ) continue;
      const stepNeeded = collider.maxY - footY;
      if (stepNeeded > 0 && stepNeeded <= options.stepHeight && options.canStep && options.velY <= 0) {
        stepUpTarget = Math.max(stepUpTarget, collider.maxY + dimensions.footOffset);
        continue;
      }

      const overlap = this.planarOverlap(character.position.x, character.position.z, co, si, collider, dimensions);
      if (!overlap) continue;
      const yLo = Math.max(footY, collider.minY);
      const yHi = Math.min(footY + dimensions.height, collider.maxY);
      if (yHi - yLo < 0.02) continue;

      if (overlap.ov0 <= overlap.ov1) {
        character.position.x -= Math.sign(overlap.dx) * Math.min(overlap.ov0, options.stepClimbSpeed * options.dt);
      } else {
        character.position.z -= Math.sign(overlap.dz) * Math.min(overlap.ov1, options.stepClimbSpeed * options.dt);
      }
      options.pushedColliders.add(collider);
    }

    return stepUpTarget;
  }

  resolveAxisAlignedVertical(options: VerticalResolveOptions): CollisionMotionState {
    const { character, dimensions } = options;
    const co = Math.cos(character.rotation.y);
    const si = Math.sin(character.rotation.y);
    const state = { ...options.state };

    for (const collider of options.colliders) {
      if (collider.isOBB || options.pushedColliders.has(collider)) continue;
      const footY = character.position.y - dimensions.footOffset;
      if (!this.planarOverlap(character.position.x, character.position.z, co, si, collider, dimensions)) continue;

      const upOverlap = collider.maxY - footY;
      const downOverlap = footY + dimensions.height - collider.minY;
      if (upOverlap <= 0 || downOverlap <= 0) continue;

      if (upOverlap <= downOverlap) {
        const goal = collider.maxY + dimensions.footOffset;
        const change = goal - character.position.y;
        if (change > 0) state.grounded = true;
        character.position.y += Math.sign(change) * Math.min(Math.abs(change), options.stepClimbSpeed * options.dt);
        if (state.velY <= 0) {
          state.velY = 0;
          state.grounded = true;
          state.extraVelX = 0;
          state.extraVelZ = 0;
        }
      } else if (footY < collider.minY) {
        const goal = collider.minY - dimensions.height + dimensions.footOffset;
        const change = goal - character.position.y;
        character.position.y += Math.sign(change) * Math.min(Math.abs(change), options.stepClimbSpeed * options.dt);
        if (state.velY > 0) state.velY = 0;
      }
    }

    return state;
  }

  resolveObbHorizontal(options: HorizontalResolveOptions): number {
    let stepUpTarget = options.stepUpTarget;
    for (const collider of options.colliders) {
      if (!collider.isOBB) continue;
      const oriented = asOrientedCollider(collider);
      if (!oriented) continue;
      const mtv = this.mtvObbVsCharacter(options.character, oriented, options.dimensions);
      if (!mtv) continue;
      const absY = Math.abs(mtv.ny);
      const horizontalLength = Math.sqrt(mtv.nx * mtv.nx + mtv.nz * mtv.nz);
      if (horizontalLength <= absY) continue;

      const footY = options.character.position.y - options.dimensions.footOffset;
      const stepNeeded = collider.maxY - footY;
      if (stepNeeded > 0 && stepNeeded <= options.stepHeight && options.canStep && options.velY <= 0) {
        stepUpTarget = Math.max(stepUpTarget, collider.maxY + options.dimensions.footOffset);
        continue;
      }

      options.character.position.x += mtv.nx * mtv.depth;
      options.character.position.z += mtv.nz * mtv.depth;
      options.pushedColliders.add(collider);
    }
    return stepUpTarget;
  }

  resolveObbVertical(options: VerticalResolveOptions): CollisionMotionState {
    const state = { ...options.state };
    for (const collider of options.colliders) {
      if (!collider.isOBB || options.pushedColliders.has(collider)) continue;
      const oriented = asOrientedCollider(collider);
      if (!oriented) continue;
      const mtv = this.mtvObbVsCharacter(options.character, oriented, options.dimensions);
      if (!mtv) continue;
      const absY = Math.abs(mtv.ny);
      const horizontalLength = Math.sqrt(mtv.nx * mtv.nx + mtv.nz * mtv.nz);
      if (horizontalLength > absY) continue;

      const pushY = absY > 0.001 ? mtv.depth / absY : mtv.depth;
      if (mtv.ny > 0) {
        options.character.position.y += pushY;
        if (state.velY <= 0) {
          state.velY = 0;
          state.grounded = true;
          state.extraVelX = 0;
          state.extraVelZ = 0;
        }
      } else {
        options.character.position.y -= pushY;
        if (state.velY > 0) state.velY = 0;
      }
    }
    return state;
  }

  characterHalfExtents(rotationY: number, dimensions: Pick<CharacterCollisionDimensions, "halfWidth" | "halfDepth">): { halfX: number; halfZ: number } {
    const co = Math.cos(rotationY);
    const si = Math.sin(rotationY);
    const aco = Math.abs(co);
    const asi = Math.abs(si);
    return {
      halfX: dimensions.halfWidth * aco + dimensions.halfDepth * asi,
      halfZ: dimensions.halfWidth * asi + dimensions.halfDepth * aco
    };
  }
}

function clampAxisDelta(delta: number, position: number, halfExtent: number, min: number, max: number): number {
  if (delta > 0) {
    const edge = position + halfExtent;
    if (edge > min) return delta;
    const allowed = min - edge;
    return allowed < delta ? Math.max(0, allowed) : delta;
  }
  if (delta < 0) {
    const edge = position - halfExtent;
    if (edge < max) return delta;
    const allowed = max - edge;
    return allowed > delta ? Math.min(0, allowed) : delta;
  }
  return delta;
}

function asOrientedCollider(collider: CharacterCollider): OrientedCollider | null {
  const required: Array<keyof OrientedCollider> = [
    "cx", "cy", "cz",
    "hx", "hy", "hz",
    "ux", "uy", "uz",
    "vx", "vy", "vz",
    "wx", "wy", "wz"
  ];
  return required.every((key) => typeof collider[key] === "number")
    ? collider as OrientedCollider
    : null;
}
