import type { WorldCollider, WorldColliderService } from "./WorldColliderService";
import type { WorldGeometryService } from "./WorldGeometryService";
import type { WorldMaterialService } from "./WorldMaterialService";

type MeshLike = {
  userData: Record<string, unknown>;
  position: { set(x: number, y: number, z: number): void };
  rotation: {
    order?: string;
    set(x: number, y: number, z: number): void;
  };
  rotateOnAxis(axis: unknown, radians: number): void;
  castShadow?: boolean;
  receiveShadow?: boolean;
  matrixAutoUpdate?: boolean;
  frustumCulled?: boolean;
  updateMatrix(): void;
  updateMatrixWorld(force?: boolean): void;
  stud_id?: number;
};

type SceneLike = {
  add(object: unknown): void;
  remove(object: unknown): void;
};

type ThreePartDeps = {
  Mesh: new (geometry: unknown, material: unknown) => MeshLike;
  Vector3: new (x: number, y: number, z: number) => unknown;
};

type WorldPartConfig = {
  THREE: ThreePartDeps;
  scene: SceneLike;
  geometry: WorldGeometryService;
  materials: WorldMaterialService;
  colliders: WorldColliderService;
  shadowsActive: () => boolean;
};

const RENDER_CHUNK_SIZE = 128;

export type WorldPartRecord = {
  m: MeshLike | null;
  b: WorldCollider | null;
  canCollide: boolean;
  sw: number;
  sh: number;
  sd: number;
  color: number;
  shape: string;
  type?: string;
  transparency: number;
};

export class WorldPartService {
  readonly studData: Array<WorldPartRecord | null> = [];
  readonly objects: MeshLike[] = [];

  private config: WorldPartConfig | null = null;

  configure(config: WorldPartConfig): this {
    this.config = config;
    return this;
  }

  addStud(
    sw: number,
    sh: number,
    sd: number,
    color: number,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
    shape = "Block",
    transparency = 0,
    staticMesh = false,
    canCollide = true,
    rotationOrder = "YXZ",
    type?: string
  ): [MeshLike, number] {
    const config = this.assertConfigured();
    const mesh = new config.THREE.Mesh(
      config.geometry.getCachedGeometry(sw, sh, sd, shape),
      config.materials.getCachedMaterials(sw, sh, sd, color, shape, transparency)
    );
    mesh.userData = mesh.userData || {};
    mesh.userData.vwebRuntimeKind = staticMesh ? "world-source-part" : "world-part";
    mesh.userData.vwebPartShape = shape;
    if (type) mesh.userData.vwebPartType = type;
    mesh.userData.vwebPartColor = color;
    mesh.userData.vwebRenderChunk = renderChunkKey(x, z);
    mesh.userData.vwebRenderCenter = { x, y: y + sh / 2, z };
    if (shape === "Block" && sh <= 4 && Math.max(sw, sd) >= 128) {
      mesh.userData.vwebDisableCastShadow = true;
    }

    const cy = y + sh / 2;
    mesh.rotation.order = rotationOrder || "YXZ";
    if (shape === "Cylinder") {
      mesh.position.set(x, cy, z);
      mesh.rotation.set(rx, ry, rz + Math.PI * 0.5);
    } else if (shape === "Wedge" || shape === "CornerWedge") {
      mesh.position.set(x, cy, z);
      mesh.rotation.set(rx, ry, rz);
      mesh.rotateOnAxis(new config.THREE.Vector3(0, 1, 0), -Math.PI * 0.5);
    } else {
      mesh.position.set(x, cy, z);
      mesh.rotation.set(rx, ry, rz);
    }

    mesh.castShadow = config.shadowsActive() && mesh.userData.vwebDisableCastShadow !== true;
    mesh.receiveShadow = config.shadowsActive() && mesh.userData.vwebDisableReceiveShadow !== true;
    mesh.matrixAutoUpdate = false;
    mesh.frustumCulled = true;
    mesh.updateMatrix();
    if (!staticMesh) config.scene.add(mesh);

    let collider: WorldCollider | null = null;
    if (canCollide) {
      collider = config.colliders.createCollider(sw, sh, sd, x, y, z, rx, ry, rz, mesh.rotation.order, shape, type);
      config.colliders.add(collider);
    }

    const storedMesh = staticMesh ? null : mesh;
    const record: WorldPartRecord = { m: storedMesh, b: collider, canCollide, sw, sh, sd, color, shape, transparency };
    if (type) record.type = type;
    const studId = this.studData.push(record) - 1;
    mesh.stud_id = studId;
    if (!staticMesh && canCollide) this.objects.push(mesh);
    return [mesh, studId];
  }

  removeStud(studId: number): void {
    const config = this.assertConfigured();
    const data = this.studData[studId];
    if (!data) return;
    const mesh = data.m;
    if (data.b) config.colliders.remove(data.b);
    if (mesh) config.scene.remove(mesh);
    if (mesh) {
      for (let i = 0; i < this.objects.length; i++) {
        if (this.objects[i]?.stud_id === studId) {
          this.objects.splice(i, 1);
          break;
        }
      }
    }
    this.studData[studId] = null;
  }

  rebuildStudCollider(studId: number, canCollide = true): boolean {
    const config = this.assertConfigured();
    const data = this.studData[studId];
    if (!data || !data.m) return false;
    if (data.b) {
      config.colliders.remove(data.b);
      data.b = null;
    }
    data.canCollide = !!canCollide;
    if (!data.canCollide) return true;
    data.m.updateMatrixWorld(true);
    const collider = config.colliders.rebuildFromObject(data.m, data.shape, data.type);
    data.b = collider;
    config.colliders.add(collider);
    if (!this.objects.includes(data.m)) this.objects.push(data.m);
    return true;
  }

  removeMatching<T>(items: T[], value: T): void {
    this.assertConfigured().colliders.removeMatchingArray(items, value);
  }

  snapshot(): { objects: number; studs: number; activeStuds: number } {
    return {
      objects: this.objects.length,
      studs: this.studData.length,
      activeStuds: this.studData.filter(Boolean).length
    };
  }

  private assertConfigured(): WorldPartConfig {
    if (!this.config) throw new Error("WorldPartService is not configured");
    return this.config;
  }
}

function renderChunkKey(x: number, z: number): string {
  return `${Math.floor(x / RENDER_CHUNK_SIZE)},${Math.floor(z / RENDER_CHUNK_SIZE)}`;
}
