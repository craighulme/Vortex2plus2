import RAPIER from "@dimforge/rapier3d-compat";
import type { DiagnosticsService } from "../diagnostics/DiagnosticsService";
import type { ColliderHandle, PhysicsBackend, PhysicsDebugRender, PhysicsWorld, PhysicsWorldSnapshot, RayHit, StaticBoxCollider } from "./types";

type CreatePhysicsWorldOptions = {
  backend: PhysicsBackend;
  diagnostics: DiagnosticsService;
};

type LegacyCollider = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
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

type RapierModule = typeof RAPIER;
type RapierWorld = InstanceType<RapierModule["World"]>;
type RapierCollider = ReturnType<RapierWorld["createCollider"]>;

export function createPhysicsWorld(options: CreatePhysicsWorldOptions): PhysicsWorld {
  if (options.backend === "rapier") return new RapierPhysicsWorld(options.diagnostics);
  return new LegacyPhysicsWorld();
}

class LegacyPhysicsWorld implements PhysicsWorld {
  readonly backend = "legacy";
  private readonly colliders = new Map<string, StaticBoxCollider>();
  private lastSyncSource = "manual";

  step(): void {}

  addStaticBox(collider: StaticBoxCollider): string {
    const handle = collider.id ?? crypto.randomUUID();
    this.colliders.set(handle, collider);
    return handle;
  }

  removeCollider(handle: string): void {
    this.colliders.delete(handle);
  }

  syncStaticCollidersFromLegacy(colliders: unknown[]): void {
    const parsed = normalizeLegacyColliders(colliders);
    this.colliders.clear();
    for (const collider of parsed) {
      this.colliders.set(collider.id ?? crypto.randomUUID(), collider);
    }
    this.lastSyncSource = signatureFor(parsed);
  }

  castRay(): null {
    return null;
  }

  debugRender(): null {
    return null;
  }

  snapshot(): PhysicsWorldSnapshot {
    return {
      backend: "legacy",
      status: "legacy",
      colliders: this.colliders.size,
      pendingColliders: 0,
      lastSyncSource: this.lastSyncSource
    };
  }

  dispose(): void {
    this.colliders.clear();
  }
}

class RapierPhysicsWorld implements PhysicsWorld {
  readonly backend = "rapier";
  private rapier: RapierModule | null = null;
  private world: RapierWorld | null = null;
  private status: PhysicsWorldSnapshot["status"] = "loading";
  private error = "";
  private lastSyncSource = "pending";
  private readonly pendingColliders: StaticBoxCollider[] = [];
  private readonly colliders = new Map<string, RapierCollider>();
  private readonly colliderIds = new Map<number, string>();
  private disposed = false;

  constructor(private readonly diagnostics: DiagnosticsService) {
    this.init().catch((error: unknown) => {
      this.status = "error";
      this.error = error instanceof Error ? error.message : String(error);
      this.diagnostics.warn("physics.rapier.init.failed", { error: this.error });
    });
  }

  step(dt: number): void {
    if (!this.world || this.status !== "ready") return;
    this.world.integrationParameters.dt = clamp(dt, 1 / 240, 1 / 30);
    this.world.step();
  }

  addStaticBox(collider: StaticBoxCollider): string {
    const handle = collider.id ?? crypto.randomUUID();
    const normalized = { ...collider, id: handle };
    if (!this.world || !this.rapier || this.status !== "ready") {
      this.pendingColliders.push(normalized);
      return handle;
    }
    this.addRapierCollider(handle, normalized);
    return handle;
  }

  removeCollider(handle: string): void {
    this.removeRapierCollider(handle);
    const index = this.pendingColliders.findIndex((collider) => collider.id === handle);
    if (index >= 0) this.pendingColliders.splice(index, 1);
  }

  syncStaticCollidersFromLegacy(colliders: unknown[]): void {
    const parsed = normalizeLegacyColliders(colliders);
    const nextSignature = signatureFor(parsed);
    if (nextSignature === this.lastSyncSource) return;
    this.lastSyncSource = nextSignature;
    this.clearColliders();
    this.pendingColliders.splice(0);
    if (!this.world || !this.rapier || this.status !== "ready") {
      for (const collider of parsed) this.addStaticBox(collider);
      return;
    }
    for (const collider of parsed) {
      const handle = collider.id ?? crypto.randomUUID();
      this.addRapierCollider(handle, { ...collider, id: handle }, false);
    }
    this.world.step();
  }

  castRay(origin: [number, number, number], direction: [number, number, number], maxDistance: number): RayHit | null {
    if (!this.world || !this.rapier || this.status !== "ready") return null;
    const dir = normalize3(direction);
    if (!dir) return null;
    const ray = new this.rapier.Ray(vector(origin), vector(dir));
    const hit = this.world.castRayAndGetNormal(ray, maxDistance, true);
    if (!hit) return null;
    const point = ray.pointAt(hit.timeOfImpact);
    return {
      collider: this.colliderIds.get(hit.collider.handle) ?? String(hit.collider.handle),
      point: [point.x, point.y, point.z],
      normal: [hit.normal.x, hit.normal.y, hit.normal.z],
      distance: hit.timeOfImpact
    };
  }

  debugRender(): PhysicsDebugRender | null {
    if (!this.world || this.status !== "ready") return null;
    const buffers = this.world.debugRender();
    return {
      vertices: buffers.vertices,
      colors: buffers.colors
    };
  }

  snapshot(): PhysicsWorldSnapshot {
    const base = {
      backend: "rapier" as const,
      status: this.disposed ? "disposed" as const : this.status,
      colliders: this.colliders.size,
      pendingColliders: this.pendingColliders.length,
      lastSyncSource: this.lastSyncSource
    };
    return {
      ...base,
      ...(this.rapier ? { version: this.rapier.version() } : {}),
      ...(this.error ? { error: this.error } : {})
    };
  }

  dispose(): void {
    this.disposed = true;
    this.clearColliders();
    this.pendingColliders.splice(0);
    this.world?.free();
    this.world = null;
    this.status = "disposed";
  }

  private async init(): Promise<void> {
    await RAPIER.init();
    if (this.disposed) return;
    this.rapier = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: -80, z: 0 });
    const queued = this.pendingColliders.splice(0);
    for (const collider of queued) this.addRapierCollider(collider.id ?? crypto.randomUUID(), collider, false);
    this.world.step();
    this.status = "ready";
    this.diagnostics.info("physics.rapier.ready", { version: RAPIER.version(), colliders: this.colliders.size });
  }

  private addRapierCollider(handle: string, collider: StaticBoxCollider, updateQueries = true): void {
    if (!this.world || !this.rapier) return;
    this.removeRapierCollider(handle);
    const hx = Math.max(0.001, collider.size[0] * 0.5);
    const hy = Math.max(0.001, collider.size[1] * 0.5);
    const hz = Math.max(0.001, collider.size[2] * 0.5);
    let desc = this.rapier.ColliderDesc
      .cuboid(hx, hy, hz)
      .setTranslation(collider.center[0], collider.center[1], collider.center[2])
      .setFriction(0.82)
      .setRestitution(0.04);
    const rotation = collider.rotationQuaternion ?? eulerToQuaternion(collider.rotation);
    if (rotation) desc = desc.setRotation({ x: rotation[0], y: rotation[1], z: rotation[2], w: rotation[3] });
    const rapierCollider = this.world.createCollider(desc);
    this.colliders.set(handle, rapierCollider);
    this.colliderIds.set(rapierCollider.handle, handle);
    if (updateQueries) this.world.step();
  }

  private removeRapierCollider(handle: string): void {
    const collider = this.colliders.get(handle);
    if (!collider || !this.world) return;
    this.colliderIds.delete(collider.handle);
    this.world.removeCollider(collider, true);
    this.colliders.delete(handle);
  }

  private clearColliders(): void {
    for (const handle of [...this.colliders.keys()]) this.removeRapierCollider(handle);
  }
}

function normalizeLegacyColliders(colliders: unknown[]): StaticBoxCollider[] {
  const parsed: StaticBoxCollider[] = [];
  for (let i = 0; i < colliders.length; i += 1) {
    const collider = normalizeLegacyCollider(colliders[i], i);
    if (collider) parsed.push(collider);
  }
  return parsed;
}

function normalizeLegacyCollider(value: unknown, index: number): StaticBoxCollider | null {
  if (!isLegacyCollider(value)) return null;
  if (value.isOBB && hasObbBasis(value)) {
    return {
      id: `legacy-${index}`,
      center: [value.cx, value.cy, value.cz],
      size: [value.hx * 2, value.hy * 2, value.hz * 2],
      rotationQuaternion: quaternionFromBasis(value)
    };
  }
  const size: [number, number, number] = [
    Math.max(0.001, value.maxX - value.minX),
    Math.max(0.001, value.maxY - value.minY),
    Math.max(0.001, value.maxZ - value.minZ)
  ];
  return {
    id: `legacy-${index}`,
    center: [
      (value.minX + value.maxX) * 0.5,
      (value.minY + value.maxY) * 0.5,
      (value.minZ + value.maxZ) * 0.5
    ],
    size
  };
}

function isLegacyCollider(value: unknown): value is LegacyCollider {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return ["minX", "maxX", "minY", "maxY", "minZ", "maxZ"].every((key) => Number.isFinite(Number(c[key])));
}

function hasObbBasis(collider: LegacyCollider): collider is Required<Pick<LegacyCollider,
  "cx" | "cy" | "cz" | "hx" | "hy" | "hz" | "ux" | "uy" | "uz" | "vx" | "vy" | "vz" | "wx" | "wy" | "wz">> & LegacyCollider {
  return ["cx", "cy", "cz", "hx", "hy", "hz", "ux", "uy", "uz", "vx", "vy", "vz", "wx", "wy", "wz"]
    .every((key) => Number.isFinite(Number(collider[key as keyof LegacyCollider])));
}

function signatureFor(colliders: StaticBoxCollider[]): string {
  let sum = 0;
  for (const collider of colliders) {
    sum += collider.center[0] * 3 + collider.center[1] * 5 + collider.center[2] * 7;
    sum += collider.size[0] * 11 + collider.size[1] * 13 + collider.size[2] * 17;
  }
  return `${colliders.length}:${Math.round(sum * 1000)}`;
}

function vector(value: [number, number, number]): { x: number; y: number; z: number } {
  return { x: value[0], y: value[1], z: value[2] };
}

function normalize3(value: [number, number, number]): [number, number, number] | null {
  const length = Math.hypot(value[0], value[1], value[2]);
  if (!Number.isFinite(length) || length <= 0.000001) return null;
  return [value[0] / length, value[1] / length, value[2] / length];
}

function eulerToQuaternion(rotation: [number, number, number] | undefined): [number, number, number, number] | null {
  if (!rotation) return null;
  const [x, y, z] = rotation;
  const c1 = Math.cos(x * 0.5);
  const c2 = Math.cos(y * 0.5);
  const c3 = Math.cos(z * 0.5);
  const s1 = Math.sin(x * 0.5);
  const s2 = Math.sin(y * 0.5);
  const s3 = Math.sin(z * 0.5);
  return [
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3
  ];
}

function quaternionFromBasis(collider: Required<Pick<LegacyCollider,
  "ux" | "uy" | "uz" | "vx" | "vy" | "vz" | "wx" | "wy" | "wz">>): [number, number, number, number] {
  const m00 = collider.ux;
  const m01 = collider.vx;
  const m02 = collider.wx;
  const m10 = collider.uy;
  const m11 = collider.vy;
  const m12 = collider.wy;
  const m20 = collider.uz;
  const m21 = collider.vz;
  const m22 = collider.wz;
  const trace = m00 + m11 + m22;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    return [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s];
  }
  if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    return [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
  }
  if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    return [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s];
  }
  const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
  return [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
