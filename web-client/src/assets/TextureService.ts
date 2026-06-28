type TextureLike = {
  image?: {
    complete?: boolean;
    naturalWidth?: number;
    naturalHeight?: number;
    videoWidth?: number;
    videoHeight?: number;
    width?: number;
    height?: number;
  };
  userData?: Record<string, unknown>;
  wrapS?: unknown;
  wrapT?: unknown;
  repeat?: { set(rx: number, ry: number): void };
  anisotropy?: number;
  colorSpace?: unknown;
  needsUpdate?: boolean;
};

type MaterialLike = {
  map?: TextureLike | null;
  normalMap?: TextureLike | null;
  userData?: Record<string, unknown>;
  needsUpdate?: boolean;
};

type ThreeTextureDeps = {
  DataTexture?: new (data: Uint8Array, width: number, height: number) => TextureLike;
  TextureLoader: new () => {
    load(
      url: string,
      onLoad?: (texture: TextureLike) => void,
      onProgress?: unknown,
      onError?: (error: unknown) => void
    ): TextureLike;
  };
  RepeatWrapping?: unknown;
  SRGBColorSpace?: unknown;
  LinearSRGBColorSpace?: unknown;
};

type TextureServiceConfig = {
  THREE: ThreeTextureDeps;
  importedAssets: {
    stud?: string;
    studNormal?: string;
  };
  maxTextureAnisotropy: number;
  onTextureChanged?: () => void;
};

export class TextureService {
  private textureLoader: InstanceType<ThreeTextureDeps["TextureLoader"]> | null = null;
  private textureCache = new Map<string, TextureLike>();
  private importedAssets: TextureServiceConfig["importedAssets"] = {};
  private repeatWrapping: unknown = null;
  private srgbColorSpace: unknown = null;
  private linearSrgbColorSpace: unknown = null;
  private dataTextureClass: ThreeTextureDeps["DataTexture"] | null = null;
  private maxTextureAnisotropy = 1;
  private onTextureChanged: () => void = () => {};
  private disabledStudMap: TextureLike | null = null;
  private disabledStudNormalMap: TextureLike | null = null;

  constructor(private readonly windowRef: Window) {}

  configure(config: TextureServiceConfig): this {
    this.textureLoader = new config.THREE.TextureLoader();
    this.importedAssets = config.importedAssets || {};
    this.repeatWrapping = config.THREE.RepeatWrapping;
    this.srgbColorSpace = config.THREE.SRGBColorSpace;
    this.linearSrgbColorSpace = config.THREE.LinearSRGBColorSpace;
    this.dataTextureClass = config.THREE.DataTexture || null;
    this.maxTextureAnisotropy = Math.max(1, Math.floor(config.maxTextureAnisotropy || 1));
    this.onTextureChanged = config.onTextureChanged || (() => {});
    return this;
  }

  useStudTextures(): boolean {
    return this.readStorageFlag("vwebStudTextures", true);
  }

  setStudTextures(value: boolean): boolean {
    this.windowRef.localStorage.setItem("vwebStudTextures", value ? "1" : "0");
    return this.useStudTextures();
  }

  applyStudTexturesToMaterial(material: MaterialLike): void {
    if (!material?.userData?.vwebStudMaterial) return;
    const settings = material.userData.vwebStudMaterial as { rx?: unknown; ry?: unknown };
    const rx = Number(settings.rx);
    const ry = Number(settings.ry);
    if (!Number.isFinite(rx) || !Number.isFinite(ry)) return;

    if (!this.useStudTextures()) {
      const disabledMap = this.disabledTexture("diffuse");
      const disabledNormalMap = this.disabledTexture("normal");
      if (material.map !== disabledMap || material.normalMap !== disabledNormalMap) {
        material.map = disabledMap;
        material.normalMap = disabledNormalMap;
        material.needsUpdate = true;
      }
      return;
    }

    const diffuse = this.studTexture(rx, ry);
    const normal = this.studNormalTexture(rx, ry);
    const nextMap = this.textureReady(diffuse) ? diffuse : (material.map ?? null);
    const nextNormalMap = this.textureReady(normal) ? normal : (material.normalMap ?? null);
    if (material.map !== nextMap || material.normalMap !== nextNormalMap) {
      material.map = nextMap;
      material.normalMap = nextNormalMap;
      material.needsUpdate = true;
    }
  }

  textureReady(texture: TextureLike | null | undefined): boolean {
    if (!texture || texture.userData?.vwebFailed) return false;
    const image = texture.image;
    if (!texture.userData?.vwebLoaded || !image) return false;
    if (typeof image.complete === "boolean" && !image.complete) return false;
    const width = Number(image.naturalWidth || image.videoWidth || image.width || 0);
    const height = Number(image.naturalHeight || image.videoHeight || image.height || 0);
    return width > 0 && height > 0;
  }

  diagnostics(): Array<Record<string, unknown>> {
    return [...this.textureCache.entries()].map(([key, texture]) => {
      const image = texture.image;
      return {
        key,
        kind: texture.userData?.vwebKind || "",
        loaded: texture.userData?.vwebLoaded === true,
        failed: texture.userData?.vwebFailed === true,
        ready: this.textureReady(texture),
        width: Number(image?.naturalWidth || image?.videoWidth || image?.width || 0),
        height: Number(image?.naturalHeight || image?.videoHeight || image?.height || 0),
        source: texture.userData?.vwebSource || ""
      };
    });
  }

  snapshot(): { textures: number; studTextures: boolean; diagnostics: Array<Record<string, unknown>> } {
    return {
      textures: this.textureCache.size,
      studTextures: this.useStudTextures(),
      diagnostics: this.diagnostics()
    };
  }

  private studTexture(rx: number, ry: number): TextureLike | null {
    return this.cachedTexture("stud", this.importedAssets.stud, rx, ry);
  }

  private studNormalTexture(rx: number, ry: number): TextureLike | null {
    return this.cachedTexture("normal", this.importedAssets.studNormal, rx, ry);
  }

  private disabledTexture(kind: "diffuse" | "normal"): TextureLike | null {
    if (kind === "diffuse") {
      if (!this.disabledStudMap) this.disabledStudMap = this.createSolidTexture([255, 255, 255, 255], "disabled-stud-diffuse", true);
      return this.disabledStudMap;
    }
    if (!this.disabledStudNormalMap) this.disabledStudNormalMap = this.createSolidTexture([128, 128, 255, 255], "disabled-stud-normal", false);
    return this.disabledStudNormalMap;
  }

  private createSolidTexture(rgba: [number, number, number, number], kind: string, srgb: boolean): TextureLike | null {
    if (!this.dataTextureClass) return null;
    const texture = new this.dataTextureClass(new Uint8Array(rgba), 1, 1);
    texture.userData = {
      ...(texture.userData || {}),
      vwebKind: kind,
      vwebSource: "generated",
      vwebLoaded: true,
      vwebFailed: false
    };
    texture.needsUpdate = true;
    if (srgb && this.srgbColorSpace) texture.colorSpace = this.srgbColorSpace;
    else if (!srgb && this.linearSrgbColorSpace) texture.colorSpace = this.linearSrgbColorSpace;
    return texture;
  }

  private cachedTexture(kind: string, url: string | undefined, rx: number, ry: number): TextureLike | null {
    if (!url || !this.textureLoader) return null;
    const key = `${kind}|${url}|${Number(rx).toFixed(4)}|${Number(ry).toFixed(4)}`;
    const cached = this.textureCache.get(key);
    if (cached) return cached;

    const texture = this.textureLoader.load(url, () => {
      texture.userData = { ...(texture.userData || {}), vwebLoaded: true };
      texture.needsUpdate = true;
      this.onTextureChanged();
    }, undefined, (error) => {
      texture.userData = { ...(texture.userData || {}), vwebFailed: true };
      console.warn("[texture] failed to load", { kind, url, error });
      this.onTextureChanged();
    });
    texture.userData = {
      ...(texture.userData || {}),
      vwebKind: kind,
      vwebSource: url,
      vwebLoaded: false,
      vwebFailed: false
    };
    texture.wrapS = this.repeatWrapping;
    texture.wrapT = this.repeatWrapping;
    texture.repeat?.set(rx, ry);
    texture.anisotropy = this.maxTextureAnisotropy;
    if (kind === "stud" && this.srgbColorSpace) texture.colorSpace = this.srgbColorSpace;
    this.textureCache.set(key, texture);
    return texture;
  }

  private readStorageFlag(key: string, fallback = false): boolean {
    const value = this.windowRef.localStorage.getItem(key);
    if (value === null) return fallback;
    return value === "1" || value === "yes" || value === "true" || value === "on";
  }
}
