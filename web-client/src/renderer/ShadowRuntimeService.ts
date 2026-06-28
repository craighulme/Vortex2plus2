import type { RendererService, ShadowQualityConfig } from "./RendererService";
import type { SceneSettingsService } from "./SceneSettingsService";
import type { CsmShadowNodeConstructor, ShadowService, ShadowServiceSnapshot } from "./ShadowService";

type ThreeShadowRuntimeDeps = {
  AmbientLight: new (color: number, intensity: number) => unknown;
  PCFSoftShadowMap?: unknown;
};

type RendererLike = {
  userData?: { vwebBackend?: string };
  shadowMap?: {
    enabled?: boolean;
    type?: unknown;
  };
};

type ShadowRuntimeConfig = {
  THREE: ThreeShadowRuntimeDeps;
  scene: { add(...objects: unknown[]): void };
  camera: unknown;
  renderer: RendererLike;
  rendererService: RendererService;
  sceneSettings: SceneSettingsService;
  CSMShadowNode: CsmShadowNodeConstructor;
  storage: Storage;
  readStorageNumber(key: string, fallback: number, min?: number, max?: number): number;
  enabled: boolean;
};

export type ShadowRuntimeHandles = {
  ambient: unknown;
  shadows: ShadowService;
  sun: ShadowService["sun"];
  sunTarget: ShadowService["sunTarget"];
  backLight: ShadowService["backLight"];
  shadowConfig: ShadowQualityConfig;
  shadowMapSize: number;
  isEnabled(): boolean;
  active(): boolean;
  syncSceneShadowFlags(root?: unknown): void;
  setEnabled(value: boolean): boolean;
  setQuality(value: string): ShadowServiceSnapshot;
  updateForFrame(): void;
};

export class ShadowRuntimeService {
  configure(config: ShadowRuntimeConfig): ShadowRuntimeHandles {
    let enabled = !!config.enabled;
    if (config.renderer.shadowMap) {
      config.renderer.shadowMap.enabled = enabled;
      config.renderer.shadowMap.type = config.THREE.PCFSoftShadowMap;
    }

    config.storage.removeItem("vwebShadowTechnique");
    const initialShadowConfig = config.rendererService.getShadowConfig?.() || {
      quality: "medium",
      mapSize: config.readStorageNumber("vwebShadowMapSize", 2048, 256, 4096),
      cascades: 4,
      maxFar: 500,
      lightMargin: 200,
      fade: true
    };
    config.storage.setItem("vwebShadowQuality", initialShadowConfig.quality || "medium");

    const ambient = new config.THREE.AmbientLight(0xffffff, 0.45);
    config.scene.add(ambient);
    const shadows = config.rendererService.createShadowService({
      THREE: config.THREE as never,
      scene: config.scene as never,
      camera: config.camera as never,
      renderer: config.renderer as never,
      backend: config.renderer.userData?.vwebBackend || config.rendererService.detectRendererBackend(config.renderer as never),
      enabled,
      shadowConfig: initialShadowConfig,
      CSMShadowNode: config.CSMShadowNode
    });

    enabled = shadows.setEnabled(enabled);
    config.storage.setItem("enableShadows", enabled ? "yes" : "no");

    const syncSceneShadowFlags = (root: unknown = config.scene) => {
      shadows.syncObjectShadowFlags(root as never);
    };

    const setEnabled = (value: boolean) => {
      enabled = shadows.setEnabled(!!value);
      config.storage.setItem("enableShadows", enabled ? "yes" : "no");
      syncSceneShadowFlags();
      config.sceneSettings.markMaterialsForShaderUpdate();
      return enabled;
    };

    const setQuality = (value: string) => {
      const next = config.rendererService.setShadowQuality(value);
      config.storage.setItem("vwebShadowQuality", next.quality || value || "medium");
      shadows.reconfigure(next);
      syncSceneShadowFlags();
      config.sceneSettings.markMaterialsForShaderUpdate();
      return shadows.snapshot();
    };

    return {
      ambient,
      shadows,
      sun: shadows.sun,
      sunTarget: shadows.sunTarget,
      backLight: shadows.backLight,
      shadowConfig: initialShadowConfig,
      shadowMapSize: initialShadowConfig.mapSize,
      isEnabled: () => enabled,
      active: () => shadows.active(),
      syncSceneShadowFlags,
      setEnabled,
      setQuality,
      updateForFrame: () => shadows.update()
    };
  }
}
