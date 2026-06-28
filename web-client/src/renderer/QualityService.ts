export type QualityServiceConfig = {
  get(): Record<string, unknown>;
  setShadows(value: unknown): unknown;
  setShadowQuality(value: unknown): unknown;
  recoverMaterials(): unknown;
  setStudTextures(value: unknown): unknown;
  diagnoseTextures(): unknown;
  setToneMapping(mode: unknown): unknown;
  setRenderFog(value: unknown): unknown;
  setFogDistance(value: unknown): unknown;
  diagnoseScene(): unknown;
  performance(): unknown;
  visual(): unknown;
};

export type RuntimeQualityOptions = {
  windowRef: Window & Record<string, unknown>;
  localStorage: Storage;
  renderer: { getPixelRatio(): number; userData?: Record<string, unknown> };
  scene: { fog?: { near: number; far: number } | null };
  shadows: { snapshot(): unknown; markNeedsUpdate(): void };
  rendererService: {
    detectRendererBackend(renderer: unknown): string;
    getShadowQuality?(): string;
    snapshot?(): unknown;
    diagnoseScene(options: Record<string, unknown>): unknown;
  };
  toneMappingMode(): string;
  fogSettings(): Record<string, unknown>;
  shadowQuality(): string;
  shadowMapSize(): number;
  shadowsActive(): boolean;
  readStorageFlag(key: string, fallback?: boolean): boolean;
  useStudTextures(): boolean;
  textureDiagnostics(): unknown;
  caches(): Record<string, unknown>;
  setShadows(value: unknown): unknown;
  setShadowQuality(value: unknown): unknown;
  setToneMapping(mode: unknown): unknown;
  setRenderFog(value: unknown): unknown;
  setFogDistance(value: unknown): unknown;
  setStudTexturesEnabled(value: boolean): void;
  refreshMaterials(): void;
  diagnoseSceneInput(): Record<string, unknown>;
};

export class QualityService {
  private config: QualityServiceConfig | null = null;

  configure(config: QualityServiceConfig): this {
    this.config = config;
    return this;
  }

  configureRuntime(options: RuntimeQualityOptions): this {
    return this.configure({
      get: () => this.buildSnapshot(options),
      setShadows: (value) => options.setShadows(value),
      setShadowQuality: (value) => options.setShadowQuality(value),
      recoverMaterials: () => {
        options.refreshMaterials();
        options.shadows.markNeedsUpdate();
        return this.get();
      },
      setStudTextures: (value) => {
        options.setStudTexturesEnabled(!!value);
        options.refreshMaterials();
        return this.get();
      },
      diagnoseTextures: () => {
        const report = options.textureDiagnostics();
        console.table(report);
        return report;
      },
      setToneMapping: (mode) => options.setToneMapping(mode),
      setRenderFog: (value) => options.setRenderFog(value),
      setFogDistance: (value) => options.setFogDistance(value),
      diagnoseScene: () => {
        const report = options.rendererService.diagnoseScene(options.diagnoseSceneInput());
        console.log("[Vortex Web] scene diagnostics", report);
        const typed = report as { darkSamples?: unknown[]; worldBatches?: unknown[] } | null | undefined;
        if (typed?.darkSamples?.length) console.table(typed.darkSamples);
        if (typed?.worldBatches?.length) console.table(typed.worldBatches.slice(0, 20));
        return report;
      },
      performance: () => {
        options.setShadows(false);
        options.localStorage.setItem("vwebAntialias", "0");
        options.setShadowQuality("low");
        options.setToneMapping("none");
        options.setRenderFog(false);
        options.setStudTexturesEnabled(false);
        options.refreshMaterials();
        return this.get();
      },
      visual: () => {
        options.setShadows(true);
        options.localStorage.setItem("vwebAntialias", "1");
        options.setShadowQuality("medium");
        options.setToneMapping("agx");
        options.setRenderFog(false);
        options.setStudTexturesEnabled(true);
        options.refreshMaterials();
        return this.get();
      }
    });
  }

  get(): Record<string, unknown> {
    return this.requireConfig().get();
  }

  setShadows(value: unknown): unknown {
    return this.requireConfig().setShadows(value);
  }

  setShadowQuality(value: unknown): unknown {
    return this.requireConfig().setShadowQuality(value);
  }

  recoverMaterials(): unknown {
    return this.requireConfig().recoverMaterials();
  }

  setStudTextures(value: unknown): unknown {
    return this.requireConfig().setStudTextures(value);
  }

  diagnoseTextures(): unknown {
    return this.requireConfig().diagnoseTextures();
  }

  setToneMapping(mode: unknown): unknown {
    return this.requireConfig().setToneMapping(mode);
  }

  setRenderFog(value: unknown): unknown {
    return this.requireConfig().setRenderFog(value);
  }

  setFogDistance(value: unknown): unknown {
    return this.requireConfig().setFogDistance(value);
  }

  diagnoseScene(): unknown {
    return this.requireConfig().diagnoseScene();
  }

  performance(): unknown {
    return this.requireConfig().performance();
  }

  visual(): unknown {
    return this.requireConfig().visual();
  }

  private requireConfig(): QualityServiceConfig {
    if (!this.config) throw new Error("QualityService is not configured");
    return this.config;
  }

  private buildSnapshot(options: RuntimeQualityOptions): Record<string, unknown> {
    const runtime = options.windowRef.VortexRuntime as { renderer?: { snapshot?(): unknown } } | undefined;
    const devTools = options.windowRef.VortexRuntimeDevTools as { active?(): boolean } | undefined;
    return {
      shadows: options.shadowsActive(),
      antialias: options.readStorageFlag("vwebAntialias", false),
      pixelRatio: options.renderer.getPixelRatio(),
      rendererBackend: options.renderer.userData?.vwebBackend || options.rendererService.detectRendererBackend(options.renderer),
      rendererBackendPreference: "webgpu",
      toneMapping: options.toneMappingMode(),
      fog: {
        ...options.fogSettings(),
        sceneFog: options.scene.fog ? { near: options.scene.fog.near, far: options.scene.fog.far } : null
      },
      shadowQuality: options.rendererService.getShadowQuality?.() || options.shadowQuality(),
      shadowMapSize: options.shadowMapSize(),
      shadowService: options.shadows.snapshot(),
      studTextures: options.useStudTextures(),
      textureDiagnostics: options.textureDiagnostics(),
      perfProfiler: !!((options.windowRef as { VortexPerf?: { enabled?: boolean } }).VortexPerf?.enabled),
      runtimeBooted: !!options.windowRef.VortexRuntime,
      runtimeDisabled: options.localStorage.getItem("vwebRuntimeDisabled") === "1",
      runtimeDevTools: !!devTools?.active?.(),
      renderer: runtime?.renderer?.snapshot?.() || null,
      caches: options.caches()
    };
  }
}
