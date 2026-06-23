export type RendererHandles = {
  scene?: unknown;
  camera?: unknown;
  renderer?: unknown;
};

export type RendererSnapshot = {
  attached: boolean;
  pixelRatio: number | null;
  webgl2: boolean | null;
  maxTextureSize: number | null;
  maxTextureUnits: number | null;
  maxAnisotropy: number | null;
  drawCalls: number | null;
  triangles: number | null;
  geometries: number | null;
  textures: number | null;
  shadowsEnabled: boolean | null;
};

type LegacyRenderer = {
  setPixelRatio?(value: number): void;
  getPixelRatio?(): number;
  getContext?(): unknown;
  capabilities?: {
    isWebGL2?: boolean;
    getMaxAnisotropy?(): number;
    maxTextureSize?: number;
    maxTextures?: number;
  };
  info?: {
    render?: { calls?: number; triangles?: number };
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
    const renderer = this.readRenderer();
    if (!renderer) {
      return {
        attached: false,
        pixelRatio: null,
        webgl2: null,
        maxTextureSize: null,
        maxTextureUnits: null,
        maxAnisotropy: null,
        drawCalls: null,
        triangles: null,
        geometries: null,
        textures: null,
        shadowsEnabled: null
      };
    }

    return {
      attached: true,
      pixelRatio: renderer.getPixelRatio?.() ?? null,
      webgl2: renderer.capabilities?.isWebGL2 ?? readWebGl2(renderer),
      maxTextureSize: renderer.capabilities?.maxTextureSize ?? readGlNumber(renderer, "MAX_TEXTURE_SIZE"),
      maxTextureUnits: renderer.capabilities?.maxTextures ?? readGlNumber(renderer, "MAX_TEXTURE_IMAGE_UNITS"),
      maxAnisotropy: renderer.capabilities?.getMaxAnisotropy?.() ?? null,
      drawCalls: renderer.info?.render?.calls ?? null,
      triangles: renderer.info?.render?.triangles ?? null,
      geometries: renderer.info?.memory?.geometries ?? null,
      textures: renderer.info?.memory?.textures ?? null,
      shadowsEnabled: renderer.shadowMap?.enabled ?? null
    };
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
  const storage = (globalThis as typeof globalThis & { localStorage?: Storage }).localStorage;
  const value = Number(storage?.getItem("v22PixelRatioCap") ?? 1);
  return Number.isFinite(value) ? Math.max(0.5, Math.min(1, value)) : 1;
}

function readWebGl2(renderer: LegacyRenderer): boolean | null {
  const context = renderer.getContext?.();
  if (!context || typeof context !== "object") return null;
  return typeof WebGL2RenderingContext !== "undefined" && context instanceof WebGL2RenderingContext;
}

function readGlNumber(renderer: LegacyRenderer, name: "MAX_TEXTURE_SIZE" | "MAX_TEXTURE_IMAGE_UNITS"): number | null {
  const context = renderer.getContext?.();
  if (!context || typeof context !== "object") return null;
  const gl = context as WebGLRenderingContext | WebGL2RenderingContext;
  const enumValue = gl[name];
  if (typeof enumValue !== "number") return null;
  const value = gl.getParameter(enumValue);
  return typeof value === "number" ? value : null;
}
