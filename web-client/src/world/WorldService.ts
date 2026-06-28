import { EntityRegistry, type EntityRecord } from "../runtime/EntityRegistry";

export type WorldPart = {
  id?: string;
  position: [number, number, number];
  size: [number, number, number];
  rotation?: [number, number, number];
  rotationOrder?: string;
  color?: number;
  canCollide?: boolean;
  transparency?: number;
  shape?: string;
  type?: string;
  legacyId?: unknown;
};

export type RawMapPart = {
  T?: string;
  Type?: string;
  P?: [number, number, number];
  Position?: [number, number, number];
  S?: [number, number, number];
  Size?: [number, number, number];
  R?: [number, number, number];
  Rotation?: [number, number, number];
  C?: number | string | [number, number, number];
  Color?: number | string | [number, number, number];
  Tr?: number;
  Transparency?: number;
  Sh?: string;
  Shape?: string;
  CantCollide?: boolean;
};

export type LoadedWorldMap = {
  name: string;
  partIds: string[];
  legacyBatchMeshes?: unknown[];
  spawn?: { x: number; y: number; z: number; ry: number };
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
    centerX: number;
    centerY: number;
    centerZ: number;
  };
};

export type LoadMapOptions = {
  preserveWorldCoords?: boolean;
  rotationRadians?: boolean;
  rotationOrder?: string;
};

export type LegacyWorldHandles = {
  addStud?: unknown;
  removeStud?: unknown;
  createMesh?: unknown;
  createGeometry?: unknown;
  scene?: unknown;
  objects?: unknown;
  bufferGeometryUtils?: unknown;
  shadowsActive?: unknown;
  setSpawn?: unknown;
  pick?: unknown;
  getObjects?: unknown;
  getColliders?: unknown;
};

export type FetchMap = (input: string, init?: Record<string, unknown>) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<RawMapPart[]>;
}>;

export class WorldService {
  readonly entities = new EntityRegistry();
  private legacyHandles: LegacyWorldHandles = {};
  private readonly maps = new Map<string, LoadedWorldMap>();

  attachLegacy(handles: LegacyWorldHandles): void {
    this.legacyHandles = { ...this.legacyHandles, ...handles };
  }

  getLegacyHandles(): LegacyWorldHandles {
    return { ...this.legacyHandles };
  }

  registerPart(part: WorldPart): EntityRecord<WorldPart> {
    return this.entities.create("part", part, part.id);
  }

  loadMapParts(name: string, raw: RawMapPart[] | string, tx = 0, ty = 1.6, tz = 0, options: LoadMapOptions = {}): LoadedWorldMap {
    const mapData = typeof raw === "string" ? JSON.parse(raw) as RawMapPart[] : raw;
    const rotationScale = options.rotationRadians ? 1 : Math.PI / 180;
    const sourceBounds = calculateSourceBounds(mapData);
    const preserveWorldCoords = Boolean(options.preserveWorldCoords);
    const ox = preserveWorldCoords ? 0 : tx - (sourceBounds.minPX + sourceBounds.maxPX) / 2;
    const oy = preserveWorldCoords ? 0 : ty - sourceBounds.minPY;
    const oz = preserveWorldCoords ? 0 : tz - (sourceBounds.minPZ + sourceBounds.maxPZ) / 2;
    const bounds = {
      minX: sourceBounds.minX + ox,
      maxX: sourceBounds.maxX + ox,
      minY: sourceBounds.minY + oy,
      maxY: sourceBounds.maxY + oy,
      minZ: sourceBounds.minZ + oz,
      maxZ: sourceBounds.maxZ + oz,
      centerX: (sourceBounds.minX + sourceBounds.maxX) / 2 + ox,
      centerY: (sourceBounds.minY + sourceBounds.maxY) / 2 + oy,
      centerZ: (sourceBounds.minZ + sourceBounds.maxZ) / 2 + oz
    };
    const partIds: string[] = [];
    const sourceMeshes: unknown[] = [];
    for (let i = 0; i < mapData.length; i += 1) {
      const parsed = normalizeRawPart(mapData[i], i, ox, oy, oz, rotationScale, options.rotationOrder);
      const entity = this.registerPart(parsed);
      partIds.push(entity.id);
      const sourceMesh = this.addLegacyPart(entity.data);
      if (sourceMesh) sourceMeshes.push(sourceMesh);
    }
    const legacyBatchMeshes = this.createLegacyMapBatches(name, sourceMeshes);
    const loaded: LoadedWorldMap = { name, partIds, bounds, legacyBatchMeshes };
    this.maps.set(name, loaded);
    return loaded;
  }

  async loadOfficialMap(gameId: number, fetchMap: FetchMap): Promise<LoadedWorldMap> {
    const name = `Official Vortex ${gameId}`;
    const res = await fetchMap(`/api/maps/${encodeURIComponent(gameId)}`, {
      credentials: "include",
      cache: "no-store"
    });
    if (!res.ok) throw new Error(`official map fetch failed: HTTP ${res.status}`);
    const mapData = await res.json();
    const loaded = this.loadMapParts(name, mapData, 0, 0, 0, {
      preserveWorldCoords: true,
      rotationRadians: officialMapUsesRadians(mapData),
      rotationOrder: "XYZ"
    });
    const spawn = {
      x: loaded.bounds.centerX,
      y: loaded.bounds.maxY + 8,
      z: loaded.bounds.centerZ,
      ry: 0
    };
    loaded.spawn = spawn;
    this.setLegacySpawn(spawn);
    this.maps.set(name, loaded);
    return loaded;
  }

  unloadMap(name: string): boolean {
    const loaded = this.maps.get(name);
    if (!loaded) return false;
    for (const id of loaded.partIds) this.remove(id);
    for (const mesh of loaded.legacyBatchMeshes ?? []) this.removeLegacyBatchMesh(mesh);
    this.maps.delete(name);
    return true;
  }

  loadedMaps(): LoadedWorldMap[] {
    return [...this.maps.values()];
  }

  remove(id: string): boolean {
    const entity = this.entities.get<WorldPart>(id);
    if (entity?.data.legacyId !== undefined) this.removeLegacyPart(entity.data.legacyId);
    return this.entities.remove(id);
  }

  private addLegacyPart(part: WorldPart): unknown | null {
    const addStud = this.legacyHandles.addStud;
    if (typeof addStud === "function") {
      const result = addStud(
        part.size[0],
        part.size[1],
        part.size[2],
        part.color,
        part.position[0],
        part.position[1] - part.size[1] * 0.5,
        part.position[2],
        part.rotation?.[0] ?? 0,
        part.rotation?.[1] ?? 0,
        part.rotation?.[2] ?? 0,
        part.shape ?? "Block",
        part.transparency ?? 0,
        true,
        part.canCollide !== false,
        part.rotationOrder || "YXZ",
        part.type
      );
      if (Array.isArray(result)) {
        part.legacyId = result[1];
        return result[0] ?? null;
      }
      return null;
    }
    return null;
  }

  private removeLegacyPart(legacyId: unknown): void {
    const removeStud = this.legacyHandles.removeStud;
    if (typeof removeStud === "function") {
      removeStud(legacyId);
      return;
    }
  }

  private createLegacyMapBatches(name: string, sourceMeshes: unknown[]): unknown[] {
    const mergeGeometries = readFunction(this.legacyHandles.bufferGeometryUtils, "mergeGeometries") as ((geometries: LegacyGeometryLike[]) => LegacyGeometryLike | null) | null;
    const createMesh = this.legacyHandles.createMesh;
    const createGeometry = this.legacyHandles.createGeometry;
    const sceneAdd = readFunction(this.legacyHandles.scene, "add");
    const objects = Array.isArray(this.legacyHandles.objects) ? this.legacyHandles.objects : null;
    if (!sourceMeshes.length || typeof mergeGeometries !== "function" || typeof createMesh !== "function" || typeof sceneAdd !== "function") {
      return [];
    }

    const geometries = new Map<string, LegacyGeometryLike[]>();
    const materials = new Map<string, { material: unknown; disableCastShadow: boolean }>();
    for (const source of sourceMeshes) {
      const mesh = source as LegacyMeshLike;
      const disableCastShadow = mesh.userData?.vwebDisableCastShadow === true;
      const materialKey = Array.isArray(mesh.material)
        ? mesh.material.map((material) => material?.uuid || "material").join("|")
        : mesh.material?.uuid || "material";
      const key = `${materialKey}|cast:${disableCastShadow ? 0 : 1}`;
      mesh.updateMatrix?.();
      const geometry = mesh.geometry?.clone?.();
      if (!geometry) continue;
      geometry.applyMatrix4?.(mesh.matrix);
      if (!materials.has(key)) {
        materials.set(key, { material: mesh.material, disableCastShadow });
        geometries.set(key, [geometry]);
      } else {
        geometries.get(key)?.push(geometry);
      }
    }

    const batches: unknown[] = [];
    for (const [key, value] of geometries) {
      const materialInfo = materials.get(key);
      if (materialInfo && Array.isArray(materialInfo.material) && typeof createGeometry === "function") {
        const geometryFactory = createGeometry as (...args: unknown[]) => unknown;
        const meshFactory = createMesh as (...args: unknown[]) => unknown;
        batches.push(...this.createSplitMaterialBatches(
          name,
          key,
          value,
          { material: materialInfo.material, disableCastShadow: materialInfo.disableCastShadow },
          mergeGeometries,
          meshFactory,
          geometryFactory,
          sceneAdd,
          objects
        ));
        continue;
      }
      const merged = mergeGeometries(value);
      if (!materialInfo || !merged) {
        for (const geometry of value) disposeGeometry(geometry);
        continue;
      }
      if (Array.isArray(materialInfo.material)) applyBoxFaceGroups(merged, value);
      for (const geometry of value) disposeGeometry(geometry);
      merged.computeBoundingBox?.();
      merged.computeBoundingSphere?.();
      const mergedMesh = createMesh(merged, materialInfo.material) as LegacyMeshLike;
      mergedMesh.userData = {
        ...(mergedMesh.userData || {}),
        vwebRuntimeKind: "world-map-batch",
        vwebMapName: name,
        vwebBatchKey: key
      };
      const shadows = this.legacyShadowsActive();
      if (materialInfo.disableCastShadow) mergedMesh.userData.vwebDisableCastShadow = true;
      mergedMesh.castShadow = shadows && !materialInfo.disableCastShadow;
      mergedMesh.receiveShadow = shadows;
      mergedMesh.matrixAutoUpdate = false;
      mergedMesh.frustumCulled = true;
      mergedMesh.updateMatrix?.();
      sceneAdd.call(this.legacyHandles.scene, mergedMesh);
      objects?.push(mergedMesh);
      batches.push(mergedMesh);
    }
    return batches;
  }

  private createSplitMaterialBatches(
    name: string,
    key: string,
    sourceGeometries: LegacyGeometryLike[],
    materialInfo: { material: Array<unknown>; disableCastShadow: boolean },
    mergeGeometries: (geometries: LegacyGeometryLike[]) => LegacyGeometryLike | null,
    createMesh: (...args: unknown[]) => unknown,
    createGeometry: (...args: unknown[]) => unknown,
    sceneAdd: (...args: unknown[]) => unknown,
    objects: unknown[] | null
  ): unknown[] {
    const topGeometries: LegacyGeometryLike[] = [];
    const sideGeometries: LegacyGeometryLike[] = [];
    for (const geometry of sourceGeometries) {
      const count = geometry.attributes?.position?.count || 0;
      if (count === 36) {
        const top = extractFaces(geometry, [2], createGeometry);
        const sides = extractFaces(geometry, [0, 1, 3, 4, 5], createGeometry);
        if (top) topGeometries.push(top);
        if (sides) sideGeometries.push(sides);
        disposeGeometry(geometry);
      } else {
        sideGeometries.push(geometry);
      }
    }

    const batches: unknown[] = [];
    const shadows = this.legacyShadowsActive();
    const addBatch = (faceKind: string, batchGeometries: LegacyGeometryLike[], material: unknown) => {
      if (!batchGeometries.length) return;
      const merged = mergeGeometries(batchGeometries);
      for (const geometry of batchGeometries) disposeGeometry(geometry);
      if (!merged) return;
      merged.computeBoundingBox?.();
      merged.computeBoundingSphere?.();
      const mesh = createMesh(merged, material) as LegacyMeshLike;
      mesh.userData = {
        ...(mesh.userData || {}),
        vwebRuntimeKind: "world-map-batch",
        vwebMapName: name,
        vwebBatchKey: `${key}|${faceKind}`,
        vwebBatchFace: faceKind
      };
      if (materialInfo.disableCastShadow) mesh.userData.vwebDisableCastShadow = true;
      mesh.castShadow = shadows && !materialInfo.disableCastShadow;
      mesh.receiveShadow = shadows;
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = true;
      mesh.updateMatrix?.();
      sceneAdd.call(this.legacyHandles.scene, mesh);
      objects?.push(mesh);
      batches.push(mesh);
    };

    addBatch("side", sideGeometries, materialInfo.material[0]);
    addBatch("top", topGeometries, materialInfo.material[2] ?? materialInfo.material[0]);
    return batches;
  }

  private removeLegacyBatchMesh(mesh: unknown): void {
    const sceneRemove = readFunction(this.legacyHandles.scene, "remove");
    if (sceneRemove) sceneRemove.call(this.legacyHandles.scene, mesh);
    const objects = Array.isArray(this.legacyHandles.objects) ? this.legacyHandles.objects : null;
    if (objects) {
      const index = objects.indexOf(mesh);
      if (index !== -1) objects.splice(index, 1);
    }
    disposeGeometry((mesh as LegacyMeshLike)?.geometry);
  }

  private setLegacySpawn(spawn: { x: number; y: number; z: number; ry: number }): void {
    const setSpawn = this.legacyHandles.setSpawn;
    if (typeof setSpawn === "function") setSpawn(spawn.x, spawn.y, spawn.z, spawn.ry);
  }

  private legacyShadowsActive(): boolean {
    const shadowsActive = this.legacyHandles.shadowsActive;
    if (typeof shadowsActive !== "function") return false;
    try {
      return !!shadowsActive();
    } catch {
      return false;
    }
  }
}

type LegacyMeshLike = {
  userData?: Record<string, unknown>;
  material?: { uuid?: string } | Array<{ uuid?: string }>;
  geometry?: LegacyGeometryLike;
  matrix?: unknown;
  castShadow?: boolean;
  receiveShadow?: boolean;
  matrixAutoUpdate?: boolean;
  frustumCulled?: boolean;
  updateMatrix?: () => void;
};

type LegacyGeometryLike = {
  clone?: () => LegacyGeometryLike;
  applyMatrix4?: (matrix: unknown) => void;
  attributes?: Record<string, LegacyAttributeLike | undefined>;
  dispose?: () => void;
  computeBoundingBox?: () => void;
  computeBoundingSphere?: () => void;
  clearGroups?: () => void;
  addGroup?: (start: number, count: number, materialIndex: number) => void;
};

type LegacyAttributeLike = {
  array?: ArrayLike<number>;
  itemSize?: number;
  count?: number;
};

function normalizeRawPart(part: RawMapPart | undefined, index: number, ox: number, oy: number, oz: number, rotationScale: number, rotationOrder?: string): WorldPart {
  const position = part?.P ?? part?.Position ?? [0, 0, 0];
  const size = part?.S ?? part?.Size ?? [4, 1, 4];
  const rotation = part?.R ?? part?.Rotation ?? [0, 0, 0];
  const normalized: WorldPart = {
    id: `map-part-${index}-${position.join("_")}`,
    position: [position[0] + ox, position[1] + oy, position[2] + oz],
    size: [size[0], size[1], size[2]],
    rotation: [rotation[0] * rotationScale, rotation[1] * rotationScale, rotation[2] * rotationScale],
    color: normalizeMapColor(part?.C ?? part?.Color ?? "808080"),
    transparency: part?.Tr ?? part?.Transparency ?? 0,
    shape: part?.Sh ?? part?.Shape ?? "Block",
    canCollide: !part?.CantCollide
  };
  const partType = part?.T ?? part?.Type;
  if (partType) normalized.type = partType;
  if (rotationOrder) normalized.rotationOrder = rotationOrder;
  return normalized;
}

function officialMapUsesRadians(mapData: RawMapPart[]): boolean {
  for (const part of mapData) {
    const rotation = part.R ?? part.Rotation;
    if (!Array.isArray(rotation)) continue;
    for (const value of rotation) {
      if (Math.abs(Number(value) || 0) > Math.PI * 2 + 0.001) return false;
    }
  }
  return true;
}

function readFunction(target: unknown, key: string): ((...args: unknown[]) => unknown) | null {
  if (!target || typeof target !== "object") return null;
  const value = (target as Record<string, unknown>)[key];
  return typeof value === "function" ? value as (...args: unknown[]) => unknown : null;
}

function applyBoxFaceGroups(merged: LegacyGeometryLike, sourceGeometries: LegacyGeometryLike[]): void {
  merged?.clearGroups?.();
  let offset = 0;
  for (const geometry of sourceGeometries) {
    const count = geometry.attributes?.position?.count || 0;
    if (count === 36) {
      for (let face = 0; face < 6; face += 1) merged?.addGroup?.(offset + face * 6, 6, face);
    } else {
      merged?.addGroup?.(offset, count, 0);
    }
    offset += count;
  }
}

function extractFaces(
  geometry: LegacyGeometryLike,
  faces: number[],
  createGeometry: (...args: unknown[]) => unknown
): LegacyGeometryLike | null {
  const attributes = geometry.attributes || {};
  const position = attributes.position;
  if (!position?.array || !position.itemSize) return null;
  const output: Record<string, { array: Float32Array; itemSize: number }> = {};
  for (const [name, attribute] of Object.entries(attributes)) {
    if (!attribute?.array || !attribute.itemSize) continue;
    const values: number[] = [];
    for (const face of faces) {
      const start = face * 6 * attribute.itemSize;
      const end = start + 6 * attribute.itemSize;
      if (end > attribute.array.length) continue;
      for (let i = start; i < end; i += 1) values.push(Number(attribute.array[i]) || 0);
    }
    output[name] = { array: new Float32Array(values), itemSize: attribute.itemSize };
  }
  return createGeometry(output) as LegacyGeometryLike;
}

function disposeGeometry(geometry: unknown): void {
  (geometry as { dispose?: () => void } | null)?.dispose?.();
}

function calculateSourceBounds(mapData: RawMapPart[]): ReturnType<typeof emptyBounds> {
  const bounds = emptyBounds();
  for (const part of mapData) {
    const position = part.P ?? part.Position ?? [0, 0, 0];
    const size = part.S ?? part.Size ?? [4, 1, 4];
    const [px, py, pz] = position;
    const [sx, sy, sz] = size;
    bounds.minPX = Math.min(bounds.minPX, px);
    bounds.maxPX = Math.max(bounds.maxPX, px);
    bounds.minPY = Math.min(bounds.minPY, py);
    bounds.maxPY = Math.max(bounds.maxPY, py);
    bounds.minPZ = Math.min(bounds.minPZ, pz);
    bounds.maxPZ = Math.max(bounds.maxPZ, pz);
    bounds.minX = Math.min(bounds.minX, px - sx / 2);
    bounds.maxX = Math.max(bounds.maxX, px + sx / 2);
    bounds.minY = Math.min(bounds.minY, py - sy / 2);
    bounds.maxY = Math.max(bounds.maxY, py + sy / 2);
    bounds.minZ = Math.min(bounds.minZ, pz - sz / 2);
    bounds.maxZ = Math.max(bounds.maxZ, pz + sz / 2);
  }
  return bounds;
}

function emptyBounds() {
  return {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
    minPX: Infinity,
    maxPX: -Infinity,
    minPY: Infinity,
    maxPY: -Infinity,
    minPZ: Infinity,
    maxPZ: -Infinity
  };
}

function normalizeMapColor(color: number | string | [number, number, number]): number {
  if (Array.isArray(color)) {
    return (Math.round(color[0] * 255) << 16) | (Math.round(color[1] * 255) << 8) | Math.round(color[2] * 255);
  }
  if (typeof color === "number") return color;
  return Number(`0x${String(color || "808080").replace(/^#/, "")}`);
}
