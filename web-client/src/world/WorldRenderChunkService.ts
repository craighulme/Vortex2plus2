export type WorldRenderChunkSnapshot = {
  chunks: number;
  objects: number;
  visibleChunks: number;
  hiddenChunks: number;
  cullDistance: number;
  minimumVisibleDistance: number;
  renderDistanceProfile: RenderDistanceProfile;
  viewCullingEnabled: boolean;
  enabled: boolean;
};

type Vec3 = { x: number; y: number; z: number };

export type WorldRenderChunkCamera = Vec3 & {
  forward?: Vec3 | null;
  verticalFovDegrees?: number | null;
  aspect?: number | null;
};

export type WorldRenderChunkBounds = {
  center: Vec3;
  radius: number;
  min?: Vec3;
  max?: Vec3;
};

export type RenderDistanceProfile = "performance" | "balanced" | "visual";

type RenderObject = {
  visible?: boolean;
  userData?: Record<string, unknown>;
};

type ChunkRecord = {
  id: string;
  mapName: string;
  chunkKey: string;
  objects: Set<RenderObject>;
  center: Vec3 | null;
  radius: number;
  min: Vec3 | null;
  max: Vec3 | null;
  visible: boolean;
};

export type WorldRenderChunkDebugRow = {
  id: string;
  mapName: string;
  chunkKey: string;
  objects: number;
  visible: boolean;
  center: Vec3 | null;
  radius: number;
  min: Vec3 | null;
  max: Vec3 | null;
};

const DEFAULT_CULL_DISTANCE = 2600;
const DEFAULT_HYSTERESIS = 192;
const DEFAULT_MINIMUM_VISIBLE_DISTANCE = 768;
const DEFAULT_VIEW_MARGIN_DEGREES = 18;
const DEFAULT_VERTICAL_FOV_DEGREES = 85;
const DEFAULT_ASPECT = 16 / 9;
const MIN_CULL_DISTANCE = 512;
const MAX_CULL_DISTANCE = 6000;

export class WorldRenderChunkService {
  private readonly chunks = new Map<string, ChunkRecord>();
  private readonly objectToChunk = new Map<RenderObject, string>();
  private cullDistance = DEFAULT_CULL_DISTANCE;
  private minimumVisibleDistance = DEFAULT_MINIMUM_VISIBLE_DISTANCE;
  private renderDistanceProfile: RenderDistanceProfile = "balanced";
  private viewCullingEnabled = true;
  private enabled = true;

  register(object: RenderObject, mapName: string, chunkKey: string, bounds: WorldRenderChunkBounds | null): void {
    const id = chunkId(mapName, chunkKey);
    let chunk = this.chunks.get(id);
    if (!chunk) {
      chunk = {
        id,
        mapName,
        chunkKey,
        objects: new Set(),
        center: bounds?.center ?? null,
        radius: bounds?.radius ?? 0,
        min: bounds?.min ?? null,
        max: bounds?.max ?? null,
        visible: true
      };
      this.chunks.set(id, chunk);
    } else if (bounds) {
      if (!chunk.center) {
        chunk.center = bounds.center;
        chunk.radius = bounds.radius;
      } else {
        expandChunkBounds(chunk, bounds);
      }
    }
    chunk.objects.add(object);
    this.objectToChunk.set(object, id);
    object.userData = {
      ...(object.userData || {}),
      vwebRenderChunk: chunkKey,
      vwebRenderChunkId: id
    };
  }

  unregister(object: RenderObject): void {
    const id = this.objectToChunk.get(object);
    if (!id) return;
    this.objectToChunk.delete(object);
    const chunk = this.chunks.get(id);
    if (!chunk) return;
    chunk.objects.delete(object);
    object.visible = true;
    if (!chunk.objects.size) this.chunks.delete(id);
  }

  update(camera: WorldRenderChunkCamera | null | undefined): WorldRenderChunkSnapshot {
    if (!camera) return this.snapshot();
    for (const chunk of this.chunks.values()) {
      const visible = this.shouldShowChunk(chunk, camera);
      if (visible === chunk.visible) continue;
      chunk.visible = visible;
      for (const object of chunk.objects) object.visible = visible;
    }
    return this.snapshot();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = !!enabled;
    if (this.enabled) return;
    for (const chunk of this.chunks.values()) {
      chunk.visible = true;
      for (const object of chunk.objects) object.visible = true;
    }
  }

  setCullDistance(distance: number): number {
    if (Number.isFinite(distance)) this.cullDistance = clamp(distance, MIN_CULL_DISTANCE, MAX_CULL_DISTANCE);
    return this.cullDistance;
  }

  setRenderDistance(distance: number, profile: RenderDistanceProfile = this.renderDistanceProfile): WorldRenderChunkSnapshot {
    this.renderDistanceProfile = normalizeRenderDistanceProfile(profile);
    this.setCullDistance(distance);
    this.setMinimumVisibleDistance(deriveNearDistance(this.cullDistance, this.renderDistanceProfile));
    return this.snapshot();
  }

  setMinimumVisibleDistance(distance: number): number {
    if (Number.isFinite(distance)) this.minimumVisibleDistance = clamp(distance, 128, this.cullDistance);
    return this.minimumVisibleDistance;
  }

  setViewCullingEnabled(enabled: boolean): void {
    this.viewCullingEnabled = !!enabled;
  }

  debugRows(): WorldRenderChunkDebugRow[] {
    return [...this.chunks.values()].map((chunk) => ({
      id: chunk.id,
      mapName: chunk.mapName,
      chunkKey: chunk.chunkKey,
      objects: chunk.objects.size,
      visible: chunk.visible,
      center: chunk.center ? { ...chunk.center } : null,
      radius: chunk.radius,
      min: chunk.min ? { ...chunk.min } : null,
      max: chunk.max ? { ...chunk.max } : null
    }));
  }

  snapshot(): WorldRenderChunkSnapshot {
    let objects = 0;
    let visibleChunks = 0;
    for (const chunk of this.chunks.values()) {
      objects += chunk.objects.size;
      if (chunk.visible) visibleChunks += 1;
    }
    return {
      chunks: this.chunks.size,
      objects,
      visibleChunks,
      hiddenChunks: this.chunks.size - visibleChunks,
      cullDistance: this.cullDistance,
      minimumVisibleDistance: this.minimumVisibleDistance,
      renderDistanceProfile: this.renderDistanceProfile,
      viewCullingEnabled: this.viewCullingEnabled,
      enabled: this.enabled
    };
  }

  clear(): void {
    for (const chunk of this.chunks.values()) {
      for (const object of chunk.objects) object.visible = true;
    }
    this.chunks.clear();
    this.objectToChunk.clear();
  }

  private shouldShowChunk(chunk: ChunkRecord, camera: WorldRenderChunkCamera): boolean {
    if (!this.enabled || !chunk.center) return true;
    const distance = Math.max(0, distanceBetween(camera, chunk.center) - chunk.radius);
    if (distance <= this.minimumVisibleDistance) return true;
    const limit = this.cullDistance + (chunk.visible ? DEFAULT_HYSTERESIS : -DEFAULT_HYSTERESIS);
    if (distance > limit) return false;
    return !this.viewCullingEnabled || isInsideCameraCone(camera, chunk.center, chunk.radius);
  }
}

function chunkId(mapName: string, chunkKey: string): string {
  return `${mapName}:${chunkKey}`;
}

function distanceBetween(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function expandChunkBounds(chunk: ChunkRecord, bounds: WorldRenderChunkBounds): void {
  if (!chunk.center) {
    chunk.center = bounds.center;
    chunk.radius = bounds.radius;
    chunk.min = bounds.min ?? null;
    chunk.max = bounds.max ?? null;
    return;
  }
  if (bounds.min && bounds.max) {
    chunk.min = chunk.min ? minVec(chunk.min, bounds.min) : bounds.min;
    chunk.max = chunk.max ? maxVec(chunk.max, bounds.max) : bounds.max;
  }
  const distance = distanceBetween(chunk.center, bounds.center);
  if (distance + bounds.radius <= chunk.radius) return;
  if (distance + chunk.radius <= bounds.radius) {
    chunk.center = bounds.center;
    chunk.radius = bounds.radius;
    chunk.min = bounds.min ?? chunk.min;
    chunk.max = bounds.max ?? chunk.max;
    return;
  }
  const nextRadius = (distance + chunk.radius + bounds.radius) / 2;
  const t = distance > 0 ? (nextRadius - chunk.radius) / distance : 0;
  chunk.center = {
    x: chunk.center.x + (bounds.center.x - chunk.center.x) * t,
    y: chunk.center.y + (bounds.center.y - chunk.center.y) * t,
    z: chunk.center.z + (bounds.center.z - chunk.center.z) * t
  };
  chunk.radius = nextRadius;
}

function minVec(a: Vec3, b: Vec3): Vec3 {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), z: Math.min(a.z, b.z) };
}

function maxVec(a: Vec3, b: Vec3): Vec3 {
  return { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y), z: Math.max(a.z, b.z) };
}

function isInsideCameraCone(camera: WorldRenderChunkCamera, center: Vec3, radius: number): boolean {
  const forward = normalize(camera.forward);
  if (!forward) return true;
  const toChunk = {
    x: center.x - camera.x,
    y: center.y - camera.y,
    z: center.z - camera.z
  };
  const distance = vectorLength(toChunk);
  if (distance <= 0.001) return true;
  const direction = {
    x: toChunk.x / distance,
    y: toChunk.y / distance,
    z: toChunk.z / distance
  };
  const dot = clamp(forward.x * direction.x + forward.y * direction.y + forward.z * direction.z, -1, 1);
  const verticalFov = degreesToRadians(Number(camera.verticalFovDegrees) || DEFAULT_VERTICAL_FOV_DEGREES);
  const aspect = Number(camera.aspect) > 0 ? Number(camera.aspect) : DEFAULT_ASPECT;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
  const halfCone = Math.max(verticalFov, horizontalFov) / 2;
  const radiusPadding = Math.asin(clamp(radius / distance, 0, 1));
  const margin = degreesToRadians(DEFAULT_VIEW_MARGIN_DEGREES);
  return Math.acos(dot) <= halfCone + radiusPadding + margin;
}

function normalize(value: Vec3 | null | undefined): Vec3 | null {
  if (!value) return null;
  const length = vectorLength(value);
  if (length <= 0.001) return null;
  return {
    x: value.x / length,
    y: value.y / length,
    z: value.z / length
  };
}

function vectorLength(value: Vec3): number {
  return Math.sqrt(value.x * value.x + value.y * value.y + value.z * value.z);
}

function degreesToRadians(value: number): number {
  return value * Math.PI / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeRenderDistanceProfile(value: unknown): RenderDistanceProfile {
  return value === "performance" || value === "visual" ? value : "balanced";
}

function deriveNearDistance(distance: number, profile: RenderDistanceProfile): number {
  const ratio = profile === "performance" ? 0.35 : profile === "visual" ? 0.5 : 0.4;
  const min = profile === "performance" ? 96 : profile === "visual" ? 192 : 128;
  return clamp(Math.round(distance * ratio), min, distance);
}
