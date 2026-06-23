import { EntityRegistry, type EntityRecord } from "../runtime/EntityRegistry";

export type WorldPart = {
  id?: string;
  position: [number, number, number];
  size: [number, number, number];
  rotation?: [number, number, number];
  color?: number;
  canCollide?: boolean;
  transparency?: number;
  shape?: string;
  legacyId?: unknown;
};

export type RawMapPart = {
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
};

export type LegacyWorldHandles = {
  addPart?: unknown;
  removePart?: unknown;
  pick?: unknown;
  getObjects?: unknown;
  getColliders?: unknown;
};

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
    for (let i = 0; i < mapData.length; i += 1) {
      const parsed = normalizeRawPart(mapData[i], i, ox, oy, oz, rotationScale);
      const entity = this.registerPart(parsed);
      partIds.push(entity.id);
      this.addLegacyPart(entity.data);
    }
    const loaded = { name, partIds, bounds };
    this.maps.set(name, loaded);
    return loaded;
  }

  unloadMap(name: string): boolean {
    const loaded = this.maps.get(name);
    if (!loaded) return false;
    for (const id of loaded.partIds) this.remove(id);
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

  private addLegacyPart(part: WorldPart): void {
    const addPart = this.legacyHandles.addPart;
    if (typeof addPart !== "function") return;
    const result = addPart(
      part.position[0],
      part.position[1],
      part.position[2],
      part.size[0],
      part.size[1],
      part.size[2],
      part.color,
      part.canCollide
    );
    if (result && typeof result === "object" && "id" in result) part.legacyId = (result as { id?: unknown }).id;
  }

  private removeLegacyPart(legacyId: unknown): void {
    const removePart = this.legacyHandles.removePart;
    if (typeof removePart === "function") removePart(legacyId);
  }
}

function normalizeRawPart(part: RawMapPart | undefined, index: number, ox: number, oy: number, oz: number, rotationScale: number): WorldPart {
  const position = part?.P ?? part?.Position ?? [0, 0, 0];
  const size = part?.S ?? part?.Size ?? [4, 1, 4];
  const rotation = part?.R ?? part?.Rotation ?? [0, 0, 0];
  return {
    id: `map-part-${index}-${position.join("_")}`,
    position: [position[0] + ox, position[1] + oy, position[2] + oz],
    size: [size[0], size[1], size[2]],
    rotation: [rotation[0] * rotationScale, rotation[1] * rotationScale, rotation[2] * rotationScale],
    color: normalizeMapColor(part?.C ?? part?.Color ?? "808080"),
    transparency: part?.Tr ?? part?.Transparency ?? 0,
    shape: part?.Sh ?? part?.Shape ?? "Block",
    canCollide: !part?.CantCollide
  };
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
