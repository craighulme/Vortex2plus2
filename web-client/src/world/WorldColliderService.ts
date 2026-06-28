export type WorldCollider = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  shape?: string;
  partType?: string;
  climbable?: boolean;
  isOBB?: boolean;
  cx?: number;
  cy?: number;
  cz?: number;
  hx?: number;
  hy?: number;
  hz?: number;
  ux?: number;
  uy?: number;
  uz?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  wx?: number;
  wy?: number;
  wz?: number;
};

type ThreeColliderDeps = {
  Matrix4: new () => { makeRotationFromEuler(euler: unknown): { elements: number[] } };
  Euler: new (rx: number, ry: number, rz: number, order?: string) => unknown;
  Box3: new () => { setFromObject(object: unknown): { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } };
};

export class WorldColliderService {
  readonly colliders: WorldCollider[] = [];
  private THREE: ThreeColliderDeps | null = null;
  private readonly chunkMap = new Map<string, Set<WorldCollider>>();
  private readonly nearbySet = new Set<WorldCollider>();

  constructor(private readonly chunkSize = 4) {}

  configure(THREE: ThreeColliderDeps): this {
    this.THREE = THREE;
    return this;
  }

  createCollider(
    sw: number,
    sh: number,
    sd: number,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
    rotationOrder = "YXZ",
    shape = "Block",
    partType?: string
  ): WorldCollider {
    let width = sw;
    let height = sh;
    let depth = sd;
    const cy = y + sh / 2;
    if (shape === "Ball") {
      width *= 0.7;
      height *= 0.7;
      depth *= 0.7;
    }
    const metadata = this.createMetadata(shape, partType);
    if (rx === 0 && ry === 0 && rz === 0) {
      return {
        minX: x - width / 2,
        maxX: x + width / 2,
        minY: y,
        maxY: y + height,
        minZ: z - depth / 2,
        maxZ: z + depth / 2,
        ...metadata
      };
    }
    return {
      ...this.buildOBB(width, height, depth, x, cy, z, rx, ry, rz, rotationOrder),
      ...metadata
    };
  }

  rebuildFromObject(object: unknown, shape?: string, partType?: string): WorldCollider {
    const THREE = this.assertConfigured();
    const box = new THREE.Box3().setFromObject(object);
    const resolvedShape = shape || readPartShape(object);
    const resolvedType = partType || readPartType(object);
    return {
      minX: box.min.x,
      maxX: box.max.x,
      minY: box.min.y,
      maxY: box.max.y,
      minZ: box.min.z,
      maxZ: box.max.z,
      ...this.createMetadata(resolvedShape, resolvedType)
    };
  }

  add(collider: WorldCollider | null | undefined): void {
    if (!collider) return;
    this.colliders.push(collider);
    this.insertToChunks(collider);
  }

  remove(collider: WorldCollider | null | undefined): void {
    if (!collider) return;
    const x0 = this.worldToChunk(collider.minX);
    const x1 = this.worldToChunk(collider.maxX);
    const y0 = this.worldToChunk(collider.minY);
    const y1 = this.worldToChunk(collider.maxY);
    const z0 = this.worldToChunk(collider.minZ);
    const z1 = this.worldToChunk(collider.maxZ);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        for (let cz = z0; cz <= z1; cz++) {
          const bucket = this.chunkMap.get(this.chunkKey(cx, cy, cz));
          if (bucket) this.removeMatchingSet(bucket, collider);
        }
      }
    }
    this.removeMatchingArray(this.colliders, collider);
  }

  removeMatchingArray<T>(items: T[], value: T): void {
    const expected = JSON.stringify(value);
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i] === value || JSON.stringify(items[i]) === expected) items.splice(i, 1);
    }
  }

  getNearbyColliders(px: number, py: number, pz: number): Set<WorldCollider> {
    this.nearbySet.clear();
    const cx = this.worldToChunk(px);
    const cy = this.worldToChunk(py);
    const cz = this.worldToChunk(pz);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const bucket = this.chunkMap.get(this.chunkKey(cx + dx, cy + dy, cz + dz));
          if (bucket) bucket.forEach((collider) => this.nearbySet.add(collider));
        }
      }
    }
    return this.nearbySet;
  }

  snapRootYToGround(input: {
    x: number;
    y: number;
    z: number;
    halfWidth: number;
    halfDepth: number;
    footOffset: number;
    tolerance?: number;
    snapDown?: number;
    snapUp?: number;
  }): number {
    const x = Number(input.x);
    const y = Number(input.y);
    const z = Number(input.z);
    if (![x, y, z].every(Number.isFinite)) return y;
    const halfWidth = Math.max(0, Number(input.halfWidth) || 0);
    const halfDepth = Math.max(0, Number(input.halfDepth) || 0);
    const footOffset = Number(input.footOffset) || 0;
    const tolerance = Math.max(0, Number(input.tolerance ?? 0.18) || 0);
    const snapDown = Math.max(0, Number(input.snapDown ?? tolerance) || 0);
    const snapUp = Math.max(0, Number(input.snapUp ?? tolerance) || 0);
    const footY = y - footOffset;
    let bestGroundY: number | null = null;

    for (const collider of this.getNearbyColliders(x, y, z)) {
      if (collider.isOBB) continue;
      if (x + halfWidth <= collider.minX || x - halfWidth >= collider.maxX) continue;
      if (z + halfDepth <= collider.minZ || z - halfDepth >= collider.maxZ) continue;
      const delta = footY - collider.maxY;
      if (delta > snapDown || delta < -snapUp) continue;
      if (bestGroundY === null || collider.maxY > bestGroundY) bestGroundY = collider.maxY;
    }

    return bestGroundY === null ? y : bestGroundY + footOffset;
  }

  worldToChunk(value: number): number {
    return Math.floor(value / this.chunkSize);
  }

  snapshot(): { colliders: number; chunks: number; chunkSize: number } {
    return {
      colliders: this.colliders.length,
      chunks: this.chunkMap.size,
      chunkSize: this.chunkSize
    };
  }

  private buildOBB(sw: number, sh: number, sd: number, cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, rotationOrder = "YXZ"): WorldCollider {
    const THREE = this.assertConfigured();
    const matrix = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, rotationOrder || "YXZ"));
    const e = matrix.elements;
    const ux = e[0] ?? 0;
    const uy = e[1] ?? 0;
    const uz = e[2] ?? 0;
    const vx = e[4] ?? 0;
    const vy = e[5] ?? 0;
    const vz = e[6] ?? 0;
    const wx = e[8] ?? 0;
    const wy = e[9] ?? 0;
    const wz = e[10] ?? 0;
    const hx = sw / 2;
    const hy = sh / 2;
    const hz = sd / 2;
    const ex = hx * Math.abs(ux) + hy * Math.abs(vx) + hz * Math.abs(wx);
    const ey = hx * Math.abs(uy) + hy * Math.abs(vy) + hz * Math.abs(wy);
    const ez = hx * Math.abs(uz) + hy * Math.abs(vz) + hz * Math.abs(wz);
    return {
      isOBB: true,
      cx,
      cy,
      cz,
      hx,
      hy,
      hz,
      ux,
      uy,
      uz,
      vx,
      vy,
      vz,
      wx,
      wy,
      wz,
      minX: cx - ex,
      maxX: cx + ex,
      minY: cy - ey,
      maxY: cy + ey,
      minZ: cz - ez,
      maxZ: cz + ez
    };
  }

  private insertToChunks(collider: WorldCollider): void {
    const x0 = this.worldToChunk(collider.minX);
    const x1 = this.worldToChunk(collider.maxX);
    const y0 = this.worldToChunk(collider.minY);
    const y1 = this.worldToChunk(collider.maxY);
    const z0 = this.worldToChunk(collider.minZ);
    const z1 = this.worldToChunk(collider.maxZ);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        for (let cz = z0; cz <= z1; cz++) {
          const key = this.chunkKey(cx, cy, cz);
          if (!this.chunkMap.has(key)) this.chunkMap.set(key, new Set());
          this.chunkMap.get(key)?.add(collider);
        }
      }
    }
  }

  private removeMatchingSet(items: Set<WorldCollider>, value: WorldCollider): void {
    if (items.delete(value)) return;
    const expected = JSON.stringify(value);
    for (const item of items) {
      if (JSON.stringify(item) === expected) items.delete(item);
    }
  }

  private chunkKey(cx: number, cy: number, cz: number): string {
    return `${cx},${cy},${cz}`;
  }

  private createMetadata(shape?: string, partType?: string): Pick<WorldCollider, "shape" | "partType" | "climbable"> {
    const normalized = typeof shape === "string" && shape.trim() ? shape.trim() : undefined;
    const normalizedType = typeof partType === "string" && partType.trim() ? partType.trim() : undefined;
    return {
      ...(normalized ? { shape: normalized } : {}),
      ...(normalizedType ? { partType: normalizedType } : {}),
      ...(isTrussKind(normalized) || isTrussKind(normalizedType) ? { climbable: true } : {})
    };
  }

  private assertConfigured(): ThreeColliderDeps {
    if (!this.THREE) throw new Error("WorldColliderService is not configured");
    return this.THREE;
  }
}

function readPartShape(object: unknown): string | undefined {
  if (!object || typeof object !== "object") return undefined;
  const userData = (object as { userData?: Record<string, unknown> }).userData;
  const shape = userData?.vwebPartShape;
  return typeof shape === "string" ? shape : undefined;
}

function readPartType(object: unknown): string | undefined {
  if (!object || typeof object !== "object") return undefined;
  const userData = (object as { userData?: Record<string, unknown> }).userData;
  const type = userData?.vwebPartType;
  return typeof type === "string" ? type : undefined;
}

function isTrussKind(value: string | undefined): boolean {
  return typeof value === "string" && /truss/i.test(value);
}
