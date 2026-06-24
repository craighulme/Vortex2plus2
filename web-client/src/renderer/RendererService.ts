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
};

export type ShadowQuality = "low" | "medium" | "high" | "ultra";

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
    v22Backend?: string;
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

  snapshot(): RendererSnapshot {
    const shadowConfig = this.getShadowConfig();
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
        shadowCascades: shadowConfig.cascades
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
      shadowCascades: shadowConfig.cascades
    };
  }

  getShadowQuality(): ShadowQuality {
    return readShadowQuality();
  }

  setShadowQuality(quality: string): ShadowQualityConfig {
    const next = normalizeShadowQuality(quality);
    readStorage()?.setItem("v22ShadowQuality", next);
    return this.getShadowConfig();
  }

  getShadowConfig(): ShadowQualityConfig {
    return shadowQualityConfig(readShadowQuality());
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
  const value = Number(storage?.getItem("v22PixelRatioCap") ?? 1);
  return Number.isFinite(value) ? Math.max(0.5, Math.min(1, value)) : 1;
}

function readStorage(): Storage | undefined {
  return (globalThis as typeof globalThis & { localStorage?: Storage }).localStorage;
}

function readShadowQuality(): ShadowQuality {
  return normalizeShadowQuality(readStorage()?.getItem("v22ShadowQuality"));
}

function normalizeShadowQuality(value: unknown): ShadowQuality {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high" || normalized === "ultra") return normalized;
  return "medium";
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
  if (renderer.userData?.v22Backend) return renderer.userData.v22Backend;
  if (renderer.isWebGPURenderer) {
    if (renderer.backend?.isWebGPUBackend === true) return "webgpu";
    return "unsupported-webgpu-fallback";
  }
  return "unsupported";
}
