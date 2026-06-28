export type DebugVisualCollider = {
  isOBB?: boolean;
  minX?: number;
  minY?: number;
  minZ?: number;
  maxX?: number;
  maxY?: number;
  maxZ?: number;
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

export type DebugVisualCharacter = {
  position: { x: number; y: number; z: number };
  rotation?: { y?: number };
};

export type DebugVisualMetrics = {
  charHalfW: number;
  charHalfD: number;
  charHeight: number;
  charFootOffset: number;
};

export type DebugVisualConfig = {
  THREE: DebugVisualThree;
  scene: DebugVisualScene;
  getNearbyColliders(px: number, py: number, pz: number): DebugVisualCollider[];
  getColliderSnapshot(): { chunkSize?: number };
  worldToChunk(value: number): number;
};

type DebugVisualThree = {
  EdgesGeometry: new (geometry: unknown) => DebugVisualGeometry;
  BoxGeometry: new (width: number, height: number, depth: number) => unknown;
  LineBasicMaterial: new (options: Record<string, unknown>) => DebugVisualMaterial;
  LineSegments: new (geometry: DebugVisualGeometry, material: DebugVisualMaterial) => DebugVisualMesh;
  Matrix4: new () => { set(...values: number[]): void };
};

type DebugVisualScene = {
  add(mesh: DebugVisualMesh): void;
  remove(mesh: DebugVisualMesh): void;
};

type DebugVisualGeometry = { dispose(): void };
type DebugVisualMaterial = { dispose(): void };
type DebugVisualMesh = {
  geometry: DebugVisualGeometry;
  material: DebugVisualMaterial;
  position: { set(x: number, y: number, z: number): void };
  rotation?: { y?: number };
  renderOrder?: number;
  setRotationFromMatrix?(matrix: unknown): void;
};

export class DebugVisualService {
  private config: DebugVisualConfig | null = null;
  private enabled = false;
  private readonly colliderMeshes: DebugVisualMesh[] = [];
  private charMesh: DebugVisualMesh | null = null;
  private chunkZoneMesh: DebugVisualMesh | null = null;

  configure(config: DebugVisualConfig): this {
    this.config = config;
    return this;
  }

  toggle(metrics: Omit<DebugVisualMetrics, "charFootOffset">): boolean {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.charMesh = this.makeWireBox(
        -metrics.charHalfW,
        0,
        -metrics.charHalfD,
        metrics.charHalfW,
        metrics.charHeight,
        metrics.charHalfD,
        0xff4444
      );
      this.config?.scene.add(this.charMesh);
    } else {
      this.clearAll();
    }
    return this.enabled;
  }

  update(character: DebugVisualCharacter | null | undefined, metrics: DebugVisualMetrics): void {
    if (!this.enabled || !character || !this.config) return;

    if (this.charMesh) {
      const footY = character.position.y - metrics.charFootOffset;
      this.charMesh.position.set(character.position.x, footY + metrics.charHeight / 2, character.position.z);
      if (this.charMesh.rotation) this.charMesh.rotation.y = character.rotation?.y ?? 0;
    }

    this.clearColliderMeshes();
    this.clearChunkZoneMesh();

    const nearby = this.config.getNearbyColliders(character.position.x, character.position.y, character.position.z);
    for (const collider of nearby) {
      const mesh = collider.isOBB ? this.makeWireOBB(collider) : this.makeAabbCollider(collider);
      if (!mesh) continue;
      this.config.scene.add(mesh);
      this.colliderMeshes.push(mesh);
    }

    const snapshot = this.config.getColliderSnapshot();
    const chunkSize = Number(snapshot.chunkSize || 0);
    if (!chunkSize) return;
    const cx = this.config.worldToChunk(character.position.x);
    const cz = this.config.worldToChunk(character.position.z);
    const zoneMinX = (cx - 1) * chunkSize;
    const zoneMaxX = (cx + 2) * chunkSize;
    const zoneMinZ = (cz - 1) * chunkSize;
    const zoneMaxZ = (cz + 2) * chunkSize;
    const zoneHeight = 512;
    this.chunkZoneMesh = this.makeWireBox(zoneMinX, -zoneHeight / 2, zoneMinZ, zoneMaxX, zoneHeight / 2, zoneMaxZ, 0x00ccff);
    this.config.scene.add(this.chunkZoneMesh);
  }

  snapshot(): { enabled: boolean; colliderMeshes: number; hasCharacterMesh: boolean; hasChunkZone: boolean } {
    return {
      enabled: this.enabled,
      colliderMeshes: this.colliderMeshes.length,
      hasCharacterMesh: Boolean(this.charMesh),
      hasChunkZone: Boolean(this.chunkZoneMesh)
    };
  }

  private makeAabbCollider(collider: DebugVisualCollider): DebugVisualMesh | null {
    const values = [collider.minX, collider.minY, collider.minZ, collider.maxX, collider.maxY, collider.maxZ];
    if (!values.every((value) => Number.isFinite(value))) return null;
    return this.makeWireBox(collider.minX!, collider.minY!, collider.minZ!, collider.maxX!, collider.maxY!, collider.maxZ!, 0xffff00);
  }

  private makeWireBox(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number, color: number): DebugVisualMesh {
    const THREE = this.requireThree();
    const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(maxX - minX, maxY - minY, maxZ - minZ));
    const material = new THREE.LineBasicMaterial({ color, depthTest: false });
    const mesh = new THREE.LineSegments(geometry, material);
    mesh.position.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
    mesh.renderOrder = 999;
    return mesh;
  }

  private makeWireOBB(collider: DebugVisualCollider): DebugVisualMesh | null {
    const values = [collider.cx, collider.cy, collider.cz, collider.hx, collider.hy, collider.hz];
    if (!values.every((value) => Number.isFinite(value))) return null;
    const THREE = this.requireThree();
    const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(collider.hx! * 2, collider.hy! * 2, collider.hz! * 2));
    const material = new THREE.LineBasicMaterial({ color: 0xff8800, depthTest: false });
    const mesh = new THREE.LineSegments(geometry, material);
    mesh.position.set(collider.cx!, collider.cy!, collider.cz!);
    const matrix = new THREE.Matrix4();
    matrix.set(
      Number(collider.ux ?? 1), Number(collider.vx ?? 0), Number(collider.wx ?? 0), 0,
      Number(collider.uy ?? 0), Number(collider.vy ?? 1), Number(collider.wy ?? 0), 0,
      Number(collider.uz ?? 0), Number(collider.vz ?? 0), Number(collider.wz ?? 1), 0,
      0, 0, 0, 1
    );
    mesh.setRotationFromMatrix?.(matrix);
    mesh.renderOrder = 999;
    return mesh;
  }

  private clearAll(): void {
    this.clearColliderMeshes();
    this.clearChunkZoneMesh();
    if (this.charMesh) {
      this.disposeMesh(this.charMesh);
      this.config?.scene.remove(this.charMesh);
      this.charMesh = null;
    }
  }

  private clearColliderMeshes(): void {
    for (const mesh of this.colliderMeshes) {
      this.disposeMesh(mesh);
      this.config?.scene.remove(mesh);
    }
    this.colliderMeshes.length = 0;
  }

  private clearChunkZoneMesh(): void {
    if (!this.chunkZoneMesh) return;
    this.disposeMesh(this.chunkZoneMesh);
    this.config?.scene.remove(this.chunkZoneMesh);
    this.chunkZoneMesh = null;
  }

  private disposeMesh(mesh: DebugVisualMesh): void {
    mesh.geometry.dispose();
    mesh.material.dispose();
  }

  private requireThree(): DebugVisualThree {
    if (!this.config) throw new Error("DebugVisualService is not configured.");
    return this.config.THREE;
  }
}
