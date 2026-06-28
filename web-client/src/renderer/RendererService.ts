import { ShadowService, type ShadowServiceOptions } from "./ShadowService";

export type RendererHandles = {
  scene?: unknown;
  camera?: unknown;
  renderer?: unknown;
};

export type RendererSnapshot = {
  attached: boolean;
  backend: string | null;
  webgpu: boolean | null;
  pixelRatio: number | null;
  maxTextureSize: number | null;
  maxTextureUnits: number | null;
  maxAnisotropy: number | null;
  drawCalls: number | null;
  triangles: number | null;
  geometries: number | null;
  textures: number | null;
  shadowsEnabled: boolean | null;
  shadowQuality: ShadowQuality;
  shadowMapSize: number;
  shadowCascades: number;
  fogEnabled: boolean;
  fogNear: number;
  fogFar: number;
};

export type ShadowQuality = "low" | "medium" | "high" | "ultra";
export type ToneMappingMode = "none" | "agx" | "aces";

export type FogSettings = {
  enabled: boolean;
  near: number;
  far: number;
};

export type ShadowQualityConfig = {
  quality: ShadowQuality;
  mapSize: number;
  cascades: number;
  maxFar: number;
  lightMargin: number;
  fade: boolean;
};

type LegacyRenderer = {
  isWebGPURenderer?: boolean;
  backend?: {
    isWebGPUBackend?: boolean;
  };
  userData?: {
    vwebBackend?: string;
  };
  setPixelRatio?(value: number): void;
  getPixelRatio?(): number;
  getContext?(): unknown;
  capabilities?: {
    getMaxAnisotropy?(): number;
    maxTextureSize?: number;
    maxTextures?: number;
  };
  info?: {
    render?: { calls?: number; drawCalls?: number; frameCalls?: number; triangles?: number };
    memory?: { geometries?: number; textures?: number };
  };
  shadowMap?: { enabled?: boolean };
};

type WebGpuRendererConstructor = new (options: Record<string, unknown>) => LegacyRenderer & {
  init?(): Promise<void>;
  userData?: {
    vwebBackend?: string;
  };
};

type WebGpuThree = {
  WebGPURenderer?: WebGpuRendererConstructor;
};

type ToneMappingRenderer = {
  toneMapping?: unknown;
};

type ToneMappingConstants = {
  AgXToneMapping?: unknown;
  ACESFilmicToneMapping?: unknown;
  NoToneMapping?: unknown;
};

type MaterialRoot = {
  traverse?(visitor: (object: unknown) => void): void;
};

type FogScene = MaterialRoot & {
  fog?: unknown | null;
};

type FogConstants = {
  Fog?: new (color: number, near: number, far: number) => unknown;
};

type DiagnosticObject = {
  uuid?: string;
  name?: string;
  type?: string;
  isMesh?: boolean;
  isLight?: boolean;
  visible?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  renderOrder?: number;
  geometry?: DiagnosticGeometry;
  material?: DiagnosticMaterial | DiagnosticMaterial[];
  userData?: Record<string, unknown>;
};

type DiagnosticGeometry = {
  boundingBox?: {
    min?: { x?: number; y?: number; z?: number };
    max?: { x?: number; y?: number; z?: number };
  } | null;
  boundingSphere?: {
    radius?: number;
  } | null;
  index?: { count?: number } | null;
  attributes?: {
    position?: { count?: number };
  };
};

type DiagnosticMaterial = {
  name?: string;
  type?: string;
  visible?: boolean;
  transparent?: boolean;
  opacity?: number;
  needsUpdate?: boolean;
  map?: unknown;
  color?: {
    r?: number;
    g?: number;
    b?: number;
    getHexString?(): string;
  };
};

type SceneDiagnostics = {
  renderer: RendererSnapshot;
  fog: FogSettings & { sceneFog: string };
  toneMapping: ToneMappingMode;
  shadows?: unknown;
  scene: {
    objects: number;
    meshes: number;
    visibleMeshes: number;
    lights: number;
    materials: number;
    castingShadowMeshes: number;
    receivingShadowMeshes: number;
    darkMaterials: number;
    blackMaterials: number;
    invisibleMaterials: number;
    textureMaterials: number;
    needsUpdateMaterials: number;
    byKind: Record<string, {
      objects: number;
      meshes: number;
      visibleMeshes: number;
      materials: number;
      castingShadowMeshes: number;
      receivingShadowMeshes: number;
      darkMaterials: number;
      blackMaterials: number;
      needsUpdateMaterials: number;
    }>;
  };
  darkSamples: Array<Record<string, unknown>>;
  worldBatches: Array<Record<string, unknown>>;
};

export class RendererService {
  private handles: RendererHandles = {};
  private optimizedRenderer: unknown = null;

  attachLegacy(handles: RendererHandles): void {
    this.handles = { ...this.handles, ...handles };
    this.applySafeDefaults();
  }

  getHandles(): RendererHandles {
    return { ...this.handles };
  }

  applySafeDefaults(): void {
    const renderer = this.readRenderer();
    if (!renderer || this.optimizedRenderer === renderer) return;
    this.optimizedRenderer = renderer;

    const devicePixelRatio = readDevicePixelRatio();
    renderer.setPixelRatio?.(Math.min(devicePixelRatio, readPixelRatioCap()));
  }

  async createWebGpuRenderer(THREE: WebGpuThree, options: Record<string, unknown> = {}): Promise<LegacyRenderer> {
    if (!THREE.WebGPURenderer) {
      throw new Error("WebGPU renderer is unavailable in this build.");
    }

    const renderer = new THREE.WebGPURenderer({
      antialias: readStorageBoolean("vwebAntialias", false),
      powerPreference: "high-performance",
      ...options
    });
    await renderer.init?.();

    const backend = this.detectRendererBackend(renderer);
    if (backend !== "webgpu") {
      throw new Error(`WebGPU backend is unavailable (${backend}).`);
    }

    renderer.userData = renderer.userData || {};
    renderer.userData.vwebBackend = backend;
    return renderer;
  }

  detectRendererBackend(renderer: LegacyRenderer): string {
    return readRendererBackend(renderer);
  }

  snapshot(): RendererSnapshot {
    const shadowConfig = this.getShadowConfig();
    const fog = this.getFogSettings();
    const renderer = this.readRenderer();
    if (!renderer) {
      return {
        attached: false,
        backend: null,
        webgpu: null,
        pixelRatio: null,
        maxTextureSize: null,
        maxTextureUnits: null,
        maxAnisotropy: null,
        drawCalls: null,
        triangles: null,
        geometries: null,
        textures: null,
        shadowsEnabled: null,
        shadowQuality: shadowConfig.quality,
        shadowMapSize: shadowConfig.mapSize,
        shadowCascades: shadowConfig.cascades,
        fogEnabled: fog.enabled,
        fogNear: fog.near,
        fogFar: fog.far
      };
    }

    return {
      attached: true,
      backend: readRendererBackend(renderer),
      webgpu: renderer.isWebGPURenderer ? renderer.backend?.isWebGPUBackend === true : false,
      pixelRatio: renderer.getPixelRatio?.() ?? null,
      maxTextureSize: renderer.capabilities?.maxTextureSize ?? null,
      maxTextureUnits: renderer.capabilities?.maxTextures ?? null,
      maxAnisotropy: renderer.capabilities?.getMaxAnisotropy?.() ?? null,
      drawCalls: renderer.info?.render?.drawCalls ?? renderer.info?.render?.calls ?? null,
      triangles: renderer.info?.render?.triangles ?? null,
      geometries: renderer.info?.memory?.geometries ?? null,
      textures: renderer.info?.memory?.textures ?? null,
      shadowsEnabled: renderer.shadowMap?.enabled ?? null,
      shadowQuality: shadowConfig.quality,
      shadowMapSize: shadowConfig.mapSize,
      shadowCascades: shadowConfig.cascades,
      fogEnabled: fog.enabled,
      fogNear: fog.near,
      fogFar: fog.far
    };
  }

  getShadowQuality(): ShadowQuality {
    return readShadowQuality();
  }

  setShadowQuality(quality: string): ShadowQualityConfig {
    const next = normalizeShadowQuality(quality);
    readStorage()?.setItem("vwebShadowQuality", next);
    return this.getShadowConfig();
  }

  getShadowConfig(): ShadowQualityConfig {
    return shadowQualityConfig(readShadowQuality());
  }

  getToneMappingMode(): ToneMappingMode {
    return readToneMappingMode();
  }

  setToneMappingMode(mode: string, options: { renderer?: ToneMappingRenderer; THREE?: ToneMappingConstants; scene?: MaterialRoot } = {}): ToneMappingMode {
    const next = normalizeToneMappingMode(mode);
    readStorage()?.setItem("vwebToneMapping", next);
    this.applyToneMapping({ ...options, mode: next });
    if (options.scene) this.markMaterialsForUpdate(options.scene);
    return next;
  }

  applyToneMapping(options: { renderer?: ToneMappingRenderer; THREE?: ToneMappingConstants; mode?: string } = {}): ToneMappingMode {
    const mode = normalizeToneMappingMode(options.mode ?? readToneMappingMode());
    if (options.renderer && options.THREE) {
      options.renderer.toneMapping = toneMappingConstant(mode, options.THREE);
    }
    return mode;
  }

  markMaterialsForUpdate(root: MaterialRoot | undefined = this.handles.scene as MaterialRoot | undefined): void {
    root?.traverse?.((object) => {
      const item = object as { material?: { needsUpdate?: boolean } | { needsUpdate?: boolean }[] };
      const material = item.material;
      if (!material) return;
      const materials = Array.isArray(material) ? material : [material];
      for (const item of materials) item.needsUpdate = true;
    });
  }

  getFogSettings(): FogSettings {
    const far = readFogDistance();
    return {
      enabled: readStorageBoolean("vwebRenderFog", false),
      near: fogNearForDistance(far),
      far
    };
  }

  setFogEnabled(enabled: boolean, options: { scene?: FogScene; THREE?: FogConstants; color?: number } = {}): FogSettings {
    readStorage()?.setItem("vwebRenderFog", enabled ? "1" : "0");
    return this.applyFog(options);
  }

  setFogDistance(distance: number, options: { scene?: FogScene; THREE?: FogConstants; color?: number } = {}): FogSettings {
    const next = normalizeFogDistance(distance);
    readStorage()?.setItem("vwebFogDistance", String(next));
    return this.applyFog(options);
  }

  applyFog(options: { scene?: FogScene; THREE?: FogConstants; color?: number } = {}): FogSettings {
    const settings = this.getFogSettings();
    if (!options.scene) return settings;
    if (!settings.enabled) {
      options.scene.fog = null;
      return settings;
    }
    if (!options.THREE?.Fog) {
      options.scene.fog = null;
      return { ...settings, enabled: false };
    }
    options.scene.fog = new options.THREE.Fog(options.color ?? 0x87ceeb, settings.near, settings.far);
    return settings;
  }

  diagnoseScene(options: {
    scene?: FogScene;
    renderer?: LegacyRenderer;
    shadows?: { snapshot?(): unknown };
    toneMappingMode?: ToneMappingMode;
  } = {}): SceneDiagnostics {
    const scene = options.scene ?? this.handles.scene as FogScene | undefined;
    const stats: SceneDiagnostics["scene"] = {
      objects: 0,
      meshes: 0,
      visibleMeshes: 0,
      lights: 0,
      materials: 0,
      castingShadowMeshes: 0,
      receivingShadowMeshes: 0,
      darkMaterials: 0,
      blackMaterials: 0,
      invisibleMaterials: 0,
      textureMaterials: 0,
      needsUpdateMaterials: 0,
      byKind: {}
    };
    const darkSamples: Array<Record<string, unknown>> = [];
    const worldBatches: Array<Record<string, unknown>> = [];

    scene?.traverse?.((object) => {
      const item = object as DiagnosticObject;
      const kind = classifyDiagnosticObject(item);
      const kindStats = stats.byKind[kind] ?? {
        objects: 0,
        meshes: 0,
        visibleMeshes: 0,
        materials: 0,
        castingShadowMeshes: 0,
        receivingShadowMeshes: 0,
        darkMaterials: 0,
        blackMaterials: 0,
        needsUpdateMaterials: 0
      };
      stats.byKind[kind] = kindStats;
      stats.objects += 1;
      kindStats.objects += 1;
      if (item.isLight) {
        stats.lights += 1;
        return;
      }
      if (!item.isMesh) return;
      stats.meshes += 1;
      kindStats.meshes += 1;
      if (kind.startsWith("world-")) {
        worldBatches.push(readWorldBatchDiagnostic(item, kind));
      }
      if (item.visible !== false) stats.visibleMeshes += 1;
      if (item.visible !== false) kindStats.visibleMeshes += 1;
      if (item.castShadow === true) {
        stats.castingShadowMeshes += 1;
        kindStats.castingShadowMeshes += 1;
      }
      if (item.receiveShadow === true) {
        stats.receivingShadowMeshes += 1;
        kindStats.receivingShadowMeshes += 1;
      }
      const materials = Array.isArray(item.material) ? item.material : item.material ? [item.material] : [];
      for (const material of materials) {
        stats.materials += 1;
        kindStats.materials += 1;
        if (material.visible === false || material.opacity === 0) stats.invisibleMaterials += 1;
        if (material.map) stats.textureMaterials += 1;
        if (material.needsUpdate) {
          stats.needsUpdateMaterials += 1;
          kindStats.needsUpdateMaterials += 1;
        }
        const color = readMaterialColor(material);
        if (!color) continue;
        if (color.luminance <= 0.08) {
          stats.darkMaterials += 1;
          kindStats.darkMaterials += 1;
        }
        if (color.luminance <= 0.01) {
          stats.blackMaterials += 1;
          kindStats.blackMaterials += 1;
        }
        if (color.luminance <= 0.08 && darkSamples.length < 16) {
          darkSamples.push({
            kind,
            object: item.name || item.type || "(unnamed)",
            material: material.name || material.type || "(unnamed)",
            visible: item.visible !== false,
            castShadow: item.castShadow === true,
            receiveShadow: item.receiveShadow === true,
            color: color.hex,
            luminance: Number(color.luminance.toFixed(4)),
            needsUpdate: material.needsUpdate === true,
            hasTexture: Boolean(material.map)
          });
        }
      }
    });

    const renderer = options.renderer ?? this.readRenderer() ?? undefined;
    const rendererWasAttached = this.handles.renderer;
    if (renderer && renderer !== rendererWasAttached) this.handles.renderer = renderer;
    const snapshot = this.snapshot();
    if (renderer && renderer !== rendererWasAttached) this.handles.renderer = rendererWasAttached;

    return {
      renderer: snapshot,
      fog: { ...this.getFogSettings(), sceneFog: describeSceneFog(scene?.fog) },
      toneMapping: options.toneMappingMode ?? this.getToneMappingMode(),
      shadows: options.shadows?.snapshot?.(),
      scene: stats,
      darkSamples,
      worldBatches: worldBatches.sort((left, right) => Number(right.footprint ?? 0) - Number(left.footprint ?? 0))
    };
  }

  createShadowService(options: ShadowServiceOptions): ShadowService {
    return new ShadowService(options);
  }

  private readRenderer(): LegacyRenderer | null {
    if (!this.handles.renderer || typeof this.handles.renderer !== "object") return null;
    return this.handles.renderer as LegacyRenderer;
  }
}

function readDevicePixelRatio(): number {
  const value = Number((globalThis as typeof globalThis & { devicePixelRatio?: unknown }).devicePixelRatio ?? 1);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function readPixelRatioCap(): number {
  const storage = readStorage();
  const value = Number(storage?.getItem("vwebPixelRatioCap") ?? 1);
  return Number.isFinite(value) ? Math.max(0.5, Math.min(1, value)) : 1;
}

function readStorageBoolean(key: string, fallback: boolean): boolean {
  const value = readStorage()?.getItem(key);
  if (value === null || value === undefined) return fallback;
  return value === "1" || value === "yes" || value === "true" || value === "on";
}

function readFogDistance(): number {
  return normalizeFogDistance(Number(readStorage()?.getItem("vwebFogDistance") ?? 900));
}

function normalizeFogDistance(value: number): number {
  return Number.isFinite(value) ? Math.max(160, Math.min(4000, Math.round(value))) : 900;
}

function fogNearForDistance(far: number): number {
  return Math.max(64, Math.round(far * 0.42));
}

function readStorage(): Storage | undefined {
  return (globalThis as typeof globalThis & { localStorage?: Storage }).localStorage;
}

function readMaterialColor(material: DiagnosticMaterial): { hex: string; luminance: number } | null {
  const color = material.color;
  if (!color) return null;
  const r = Number(color.r ?? 0);
  const g = Number(color.g ?? 0);
  const b = Number(color.b ?? 0);
  if (![r, g, b].every(Number.isFinite)) return null;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const hex = typeof color.getHexString === "function"
    ? `#${color.getHexString()}`
    : `#${toByteHex(r)}${toByteHex(g)}${toByteHex(b)}`;
  return { hex, luminance };
}

function toByteHex(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value * 255))).toString(16).padStart(2, "0");
}

function describeSceneFog(fog: unknown): string {
  if (!fog || typeof fog !== "object") return "none";
  const item = fog as { near?: unknown; far?: unknown };
  return `near=${String(item.near ?? "?")} far=${String(item.far ?? "?")}`;
}

function classifyDiagnosticObject(object: DiagnosticObject): string {
  const kind = object.userData?.vwebRuntimeKind;
  if (typeof kind === "string" && kind) return kind;
  const name = `${object.name || ""} ${object.type || ""}`.toLowerCase();
  if (name.includes("r7body") || name.includes("avatar") || name.includes("character")) return "avatar";
  if (object.isLight) return "light";
  if (object.isMesh) return "unclassified-mesh";
  return "other";
}

function readWorldBatchDiagnostic(object: DiagnosticObject, kind: string): Record<string, unknown> {
  const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
  const firstMaterial = materials[0];
  const color = firstMaterial ? readMaterialColor(firstMaterial) : null;
  const bounds = readGeometryBounds(object.geometry);
  return {
    kind,
    uuid: object.uuid ?? null,
    object: object.name || object.type || "(unnamed)",
    mapName: stringOrNull(object.userData?.vwebMapName),
    batchKey: stringOrNull(object.userData?.vwebBatchKey),
    visible: object.visible !== false,
    castShadow: object.castShadow === true,
    receiveShadow: object.receiveShadow === true,
    renderOrder: Number(object.renderOrder ?? 0),
    material: firstMaterial?.name || firstMaterial?.type || "(none)",
    materialCount: materials.length,
    color: color?.hex ?? null,
    luminance: color ? Number(color.luminance.toFixed(4)) : null,
    hasTexture: Boolean(firstMaterial?.map),
    needsUpdate: materials.some((material) => material.needsUpdate === true),
    vertices: Number(object.geometry?.attributes?.position?.count ?? 0),
    triangles: Math.round(Number(object.geometry?.index?.count ?? object.geometry?.attributes?.position?.count ?? 0) / 3),
    bounds,
    footprint: bounds ? Number((bounds.size.x * bounds.size.z).toFixed(3)) : null,
    volume: bounds ? Number((bounds.size.x * bounds.size.y * bounds.size.z).toFixed(3)) : null,
    radius: finiteOrNull(object.geometry?.boundingSphere?.radius)
  };
}

function readGeometryBounds(geometry: DiagnosticGeometry | undefined): {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
  center: { x: number; y: number; z: number };
} | null {
  const min = geometry?.boundingBox?.min;
  const max = geometry?.boundingBox?.max;
  const minX = finiteOrNull(min?.x);
  const minY = finiteOrNull(min?.y);
  const minZ = finiteOrNull(min?.z);
  const maxX = finiteOrNull(max?.x);
  const maxY = finiteOrNull(max?.y);
  const maxZ = finiteOrNull(max?.z);
  if (minX === null || minY === null || minZ === null || maxX === null || maxY === null || maxZ === null) return null;
  const size = {
    x: Number((maxX - minX).toFixed(3)),
    y: Number((maxY - minY).toFixed(3)),
    z: Number((maxZ - minZ).toFixed(3))
  };
  return {
    min: { x: round3(minX), y: round3(minY), z: round3(minZ) },
    max: { x: round3(maxX), y: round3(maxY), z: round3(maxZ) },
    size,
    center: {
      x: round3((minX + maxX) * 0.5),
      y: round3((minY + maxY) * 0.5),
      z: round3((minZ + maxZ) * 0.5)
    }
  };
}

function finiteOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function readShadowQuality(): ShadowQuality {
  return normalizeShadowQuality(readStorage()?.getItem("vwebShadowQuality"));
}

function normalizeShadowQuality(value: unknown): ShadowQuality {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high" || normalized === "ultra") return normalized;
  return "medium";
}

function readToneMappingMode(): ToneMappingMode {
  return normalizeToneMappingMode(readStorage()?.getItem("vwebToneMapping"));
}

function normalizeToneMappingMode(value: unknown): ToneMappingMode {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "agx" || normalized === "aces") return normalized;
  return "none";
}

function toneMappingConstant(mode: ToneMappingMode, constants: ToneMappingConstants): unknown {
  if (mode === "agx" && constants.AgXToneMapping !== undefined) return constants.AgXToneMapping;
  if (mode === "aces" && constants.ACESFilmicToneMapping !== undefined) return constants.ACESFilmicToneMapping;
  return constants.NoToneMapping;
}

function shadowQualityConfig(quality: ShadowQuality): ShadowQualityConfig {
  switch (quality) {
    case "low":
      return { quality, mapSize: 1024, cascades: 3, maxFar: 360, lightMargin: 160, fade: true };
    case "high":
      return { quality, mapSize: 3072, cascades: 4, maxFar: 650, lightMargin: 220, fade: true };
    case "ultra":
      return { quality, mapSize: 4096, cascades: 4, maxFar: 850, lightMargin: 260, fade: true };
    case "medium":
    default:
      return { quality: "medium", mapSize: 2048, cascades: 4, maxFar: 500, lightMargin: 200, fade: true };
  }
}

function readRendererBackend(renderer: LegacyRenderer): string {
  if (renderer.userData?.vwebBackend) return renderer.userData.vwebBackend;
  if (renderer.isWebGPURenderer) {
    if (renderer.backend?.isWebGPUBackend === true) return "webgpu";
    return "unsupported-webgpu-fallback";
  }
  return "unsupported";
}
