import type { ShadowQualityConfig } from "./RendererService";

type VectorLike = {
  set(x: number, y: number, z: number): void;
};

type SceneLike = {
  add(...objects: unknown[]): void;
  traverse?(visitor: (object: SceneObjectLike) => void): void;
};

type SceneObjectLike = {
  isMesh?: boolean;
  material?: MaterialLike | MaterialLike[];
  castShadow?: boolean;
  receiveShadow?: boolean;
  userData?: {
    vwebDisableCastShadow?: boolean;
    vwebDisableReceiveShadow?: boolean;
  };
};

type MaterialLike = {
  needsUpdate?: boolean;
};

type CameraLike = {
  near?: number;
  far?: number;
  fov?: number;
  aspect?: number;
  zoom?: number;
};

type ShadowCameraLike = CameraLike & {
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
};

type ShadowMapLike = {
  enabled?: boolean;
  type?: unknown;
  needsUpdate?: boolean;
};

type RendererLike = {
  shadowMap?: ShadowMapLike;
};

type LightShadowLike = {
  mapSize: { width: number; height: number };
  camera: ShadowCameraLike;
  autoUpdate?: boolean;
  bias?: number;
  shadowNode?: unknown;
};

type DirectionalLightLike = {
  castShadow?: boolean;
  shadow: LightShadowLike;
  position: VectorLike;
  target?: unknown;
};

type Object3DLike = {
  position: VectorLike;
};

type ThreeLike = {
  DirectionalLight: new (color: number, intensity: number) => DirectionalLightLike;
  Object3D: new () => Object3DLike;
  PCFShadowMap?: unknown;
};

type CsmShadowNodeLike = {
  camera?: CameraLike;
  maxFar?: number;
  cascades?: number;
  mode?: string;
  updateFrustums(): void;
  dispose?(): void;
};

export type CsmShadowNodeConstructor = new (
  light: DirectionalLightLike,
  options: {
    maxFar: number;
    cascades: number;
    mode: "practical";
    lightMargin: number;
    fade: boolean;
  }
) => CsmShadowNodeLike;

export type ShadowServiceOptions = {
  THREE: ThreeLike;
  scene: SceneLike;
  camera: CameraLike;
  renderer: RendererLike;
  backend: string;
  enabled: boolean;
  shadowConfig: ShadowQualityConfig;
  CSMShadowNode: CsmShadowNodeConstructor;
};

export type ShadowServiceSnapshot = {
  enabled: boolean;
  active: boolean;
  backend: string;
  technique: "csm";
  implementation: "CSMShadowNode" | "DirectionalLightShadow";
  quality: ShadowQualityConfig["quality"];
  csmSupported: true;
  webgpuCsmSupported: true;
  cascades: number;
  maxFar: number;
  shadowMapSize: number;
  disabledReason: null;
};

export class ShadowService {
  readonly sun: DirectionalLightLike;
  readonly sunTarget: Object3DLike;
  readonly backLight: DirectionalLightLike;
  readonly technique = "csm";

  private readonly THREE: ThreeLike;
  private readonly scene: SceneLike;
  private readonly camera: CameraLike;
  private readonly renderer: RendererLike;
  private readonly backend: string;
  private readonly CSMShadowNode: CsmShadowNodeConstructor;
  private enabled: boolean;
  private shadowConfig: ShadowQualityConfig;
  private shadowMapSize: number;
  private csmShadowNode: CsmShadowNodeLike | null = null;
  private lastCsmProjectionSignature = "";

  constructor(options: ShadowServiceOptions) {
    this.THREE = options.THREE;
    this.scene = options.scene;
    this.camera = options.camera;
    this.renderer = options.renderer;
    this.backend = options.backend;
    this.CSMShadowNode = options.CSMShadowNode;
    this.enabled = options.enabled;
    this.shadowConfig = normalizeShadowConfig(options.shadowConfig);
    this.shadowMapSize = this.shadowConfig.mapSize;

    this.sun = new this.THREE.DirectionalLight(0xffffff, 3);
    this.sunTarget = new this.THREE.Object3D();
    this.backLight = new this.THREE.DirectionalLight(0xffffff, 0.4);

    this.configureRenderer();
    this.configureStandardSun();
    this.configureBackLight();

    this.scene.add(this.sun);
    this.scene.add(this.sunTarget);
    this.scene.add(this.backLight);

    this.createCsmShadowNode();
    this.setEnabled(this.enabled);
  }

  active(): boolean {
    return !!this.enabled && this.renderer.shadowMap?.enabled === true;
  }

  setEnabled(value: boolean): boolean {
    this.enabled = !!value;
    if (this.renderer.shadowMap) {
      this.renderer.shadowMap.enabled = this.enabled;
      this.renderer.shadowMap.needsUpdate = this.enabled;
    }
    this.sun.castShadow = this.enabled;
    this.sun.shadow.autoUpdate = this.enabled;
    if (this.enabled && this.csmShadowNode) {
      this.sun.shadow.shadowNode = this.csmShadowNode;
    } else {
      delete this.sun.shadow.shadowNode;
    }
    return this.enabled;
  }

  reconfigure(config: ShadowQualityConfig): ShadowServiceSnapshot {
    const next = normalizeShadowConfig(config);
    if (sameShadowConfig(this.shadowConfig, next)) return this.snapshot();

    if (this.csmShadowNode) {
      delete this.sun.shadow.shadowNode;
      this.csmShadowNode.dispose?.();
      this.csmShadowNode = null;
    }

    this.shadowConfig = next;
    this.shadowMapSize = next.mapSize;
    this.lastCsmProjectionSignature = "";
    this.configureRenderer();
    this.configureStandardSun();
    this.createCsmShadowNode();
    this.setEnabled(this.enabled);
    this.markSceneMaterialsForUpdate();
    this.markNeedsUpdate();
    return this.snapshot();
  }

  syncObjectShadowFlags(root: SceneLike): void {
    const active = this.active();
    root.traverse?.((object) => {
      if (!object.isMesh) return;
      object.castShadow = active && object.userData?.vwebDisableCastShadow !== true;
      object.receiveShadow = active && object.userData?.vwebDisableReceiveShadow !== true;
    });
  }

  markNeedsUpdate(): void {
    if (this.active() && this.renderer.shadowMap) this.renderer.shadowMap.needsUpdate = true;
  }

  markSceneMaterialsForUpdate(root: SceneLike = this.scene): void {
    root.traverse?.((object) => {
      const material = object.material;
      if (!material) return;
      const materials = Array.isArray(material) ? material : [material];
      for (const item of materials) item.needsUpdate = true;
    });
  }

  update(): void {
    if (!this.active()) return;
    if (this.csmShadowNode?.camera) {
      const projectionSignature = this.getProjectionSignature();
      if (projectionSignature !== this.lastCsmProjectionSignature) {
        this.lastCsmProjectionSignature = projectionSignature;
        this.csmShadowNode.updateFrustums();
      }
    }
  }

  snapshot(): ShadowServiceSnapshot {
    return {
      enabled: this.enabled,
      active: this.active(),
      backend: this.backend,
      technique: this.technique,
      implementation: this.csmShadowNode ? "CSMShadowNode" : "DirectionalLightShadow",
      quality: this.shadowConfig.quality,
      csmSupported: true,
      webgpuCsmSupported: true,
      cascades: this.csmShadowNode?.cascades || 0,
      maxFar: this.shadowConfig.maxFar,
      shadowMapSize: this.shadowMapSize,
      disabledReason: null
    };
  }

  private configureRenderer(): void {
    if (!this.renderer.shadowMap) return;
    this.renderer.shadowMap.enabled = this.enabled;
    this.renderer.shadowMap.type = this.THREE.PCFShadowMap;
  }

  private configureStandardSun(): void {
    this.sun.castShadow = this.enabled;
    this.sun.shadow.mapSize.width = this.shadowMapSize;
    this.sun.shadow.mapSize.height = this.shadowMapSize;
    this.sun.shadow.camera.near = 0.1;
    const size = 350;
    this.sun.shadow.camera.far = 2 * size;
    this.sun.shadow.camera.left = -size;
    this.sun.shadow.camera.right = size;
    this.sun.shadow.camera.top = size;
    this.sun.shadow.camera.bottom = -size;
    this.sun.shadow.autoUpdate = this.enabled;
    this.sun.shadow.bias = -0.00003;
    delete this.sun.shadow.shadowNode;
    this.sun.position.set(1, 2, 1);
    this.sunTarget.position.set(0, 0, 0);
    this.sun.target = this.sunTarget;
  }

  private configureBackLight(): void {
    this.backLight.position.set(-160, 500, -160);
    this.backLight.castShadow = false;
  }

  private createCsmShadowNode(): void {
    this.sun.shadow.mapSize.width = this.shadowMapSize;
    this.sun.shadow.mapSize.height = this.shadowMapSize;
    this.csmShadowNode = new this.CSMShadowNode(this.sun, {
      maxFar: this.shadowConfig.maxFar,
      cascades: this.shadowConfig.cascades,
      mode: "practical",
      lightMargin: this.shadowConfig.lightMargin,
      fade: this.shadowConfig.fade
    });
  }

  private getProjectionSignature(): string {
    const camera = this.csmShadowNode?.camera || this.camera;
    return [
      camera.near,
      camera.far,
      camera.fov,
      camera.aspect,
      camera.zoom,
      this.csmShadowNode?.maxFar,
      this.csmShadowNode?.cascades,
      this.csmShadowNode?.mode
    ].join("|");
  }
}

function normalizeShadowConfig(config: ShadowQualityConfig): ShadowQualityConfig {
  return {
    quality: config.quality,
    mapSize: Number.isFinite(config.mapSize) ? config.mapSize : 2048,
    cascades: Number.isFinite(config.cascades) ? config.cascades : 4,
    maxFar: Number.isFinite(config.maxFar) ? config.maxFar : 500,
    lightMargin: Number.isFinite(config.lightMargin) ? config.lightMargin : 200,
    fade: config.fade !== false
  };
}

function sameShadowConfig(left: ShadowQualityConfig, right: ShadowQualityConfig): boolean {
  return left.quality === right.quality
    && left.mapSize === right.mapSize
    && left.cascades === right.cascades
    && left.maxFar === right.maxFar
    && left.lightMargin === right.lightMargin
    && left.fade === right.fade;
}
