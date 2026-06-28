type ThreeLike = Record<string, any>;

export type EngineSceneRuntimeOptions = {
  windowRef: Window & Record<string, any>;
  document: Document;
  localStorage: Storage;
  THREE: ThreeLike;
  CSMShadowNode: unknown;
  scene: any;
  camera: any;
  rendererService: any;
  sceneSettings: any;
  shadowRuntime: any;
  perf: any;
  settingsStore: {
    readFlag(key: string, fallback?: boolean): boolean;
    readNumber(key: string, fallback: number, min?: number, max?: number): number;
  };
};

export type EngineSceneRuntimeHandles = {
  renderer: any;
  rendererBackend: string;
  isWebGpuRuntime: boolean;
  ambient: any;
  shadows: any;
  sun: any;
  sunTarget: any;
  backLight: any;
  shadowConfig: any;
  shadowMapSize: number;
  perf: any;
  readStorageFlag(key: string, fallback?: boolean): boolean;
  readStorageNumber(key: string, fallback: number, min?: number, max?: number): number;
  shadowsActive(): boolean;
  syncSceneShadowFlags(root?: any): void;
  setShadowsEnabled(value: boolean): boolean;
  setShadowQuality(value: string): unknown;
  updateLightingForFrame(): void;
  readShadowsEnabled(): boolean;
};

export class EngineSceneRuntimeService {
  async configure(options: EngineSceneRuntimeOptions): Promise<EngineSceneRuntimeHandles> {
    const readStorageFlag = (key: string, fallback = false): boolean => options.settingsStore.readFlag(key, fallback);
    const readStorageNumber = (key: string, fallback: number, min = -Infinity, max = Infinity): number => {
      return options.settingsStore.readNumber(key, fallback, min, max);
    };

    let enableShadows = readStorageFlag("enableShadows", false);
    const renderer = await options.rendererService.createWebGpuRenderer(options.THREE);
    const rendererBackend = renderer.userData?.vwebBackend || options.rendererService.detectRendererBackend(renderer);
    options.windowRef.__VORTEX_RENDERER_BACKEND = rendererBackend;
    const isWebGpuRuntime = rendererBackend === "webgpu";

    renderer.setClearColor(0x87CEEB);
    renderer.setSize(options.windowRef.innerWidth, options.windowRef.innerHeight);
    if (renderer.shadowMap) {
      renderer.shadowMap.enabled = enableShadows;
      renderer.shadowMap.type = options.THREE.PCFSoftShadowMap;
    }
    renderer.setPixelRatio(Math.min(options.windowRef.devicePixelRatio, readStorageNumber("vwebPixelRatioCap", 1, 0.5, 1)));
    console.info("[renderer] backend", rendererBackend);
    options.document.getElementById("scene")?.appendChild(renderer.domElement);
    options.windowRef.addEventListener("resize", () => {
      options.camera.aspect = options.windowRef.innerWidth / options.windowRef.innerHeight;
      options.camera.updateProjectionMatrix();
      renderer.setSize(options.windowRef.innerWidth, options.windowRef.innerHeight);
    });

    const sceneSettingsHandles = options.sceneSettings.configure({
      rendererService: options.rendererService,
      scene: options.scene,
      renderer,
      THREE: options.THREE
    });
    if (!sceneSettingsHandles) {
      throw new Error("[renderer] VortexRuntime scene settings service is required before the engine starts.");
    }

    const shadowHandles = options.shadowRuntime.configure({
      THREE: options.THREE,
      scene: options.scene,
      camera: options.camera,
      renderer,
      rendererService: options.rendererService,
      sceneSettings: sceneSettingsHandles,
      CSMShadowNode: options.CSMShadowNode,
      storage: options.localStorage,
      readStorageNumber,
      enabled: enableShadows
    });
    if (!shadowHandles) {
      throw new Error("[renderer] VortexRuntime shadow runtime service is required before the engine starts.");
    }

    options.windowRef.backLight = shadowHandles.backLight;
    options.windowRef.VortexShadowService = shadowHandles.shadows;
    enableShadows = shadowHandles.isEnabled();

    const profiler = options.perf.configure({
      renderer,
      detectRendererBackend: (value: unknown) => options.rendererService.detectRendererBackend(value),
      readQuality: () => options.windowRef.VortexQuality?.get?.() || null
    });
    if (!profiler) {
      throw new Error("[diagnostics] VortexRuntime performance service is required before the engine starts.");
    }
    options.windowRef.VortexPerf = profiler;

    return {
      renderer,
      rendererBackend,
      isWebGpuRuntime,
      ambient: shadowHandles.ambient,
      shadows: shadowHandles.shadows,
      sun: shadowHandles.sun,
      sunTarget: shadowHandles.sunTarget,
      backLight: shadowHandles.backLight,
      shadowConfig: shadowHandles.shadowConfig,
      shadowMapSize: shadowHandles.shadowMapSize,
      perf: profiler,
      readStorageFlag,
      readStorageNumber,
      shadowsActive: () => shadowHandles.active(),
      syncSceneShadowFlags: (root = options.scene) => shadowHandles.syncSceneShadowFlags(root),
      setShadowsEnabled: (value) => {
        enableShadows = shadowHandles.setEnabled(!!value);
        return enableShadows;
      },
      setShadowQuality: (value) => shadowHandles.setQuality(value),
      updateLightingForFrame: () => shadowHandles.updateForFrame(),
      readShadowsEnabled: () => enableShadows
    };
  }
}
