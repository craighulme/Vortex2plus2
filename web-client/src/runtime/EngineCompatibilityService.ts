export type EngineCompatibilityVortexApi = Record<string, unknown>;

export type EngineCompatibilityOptions = {
  windowRef: Window & Record<string, unknown>;
  detailTarget?: EventTarget;
  three: unknown;
  gltfLoaderClass: unknown;
  gltfLoader: unknown;
  scene: unknown;
  ambient: unknown;
  renderer: unknown;
  objects: unknown[];
  camera: unknown;
  cam: unknown;
  vortexApi: EngineCompatibilityVortexApi;
  rendererService: {
    attachLegacy(handles: { scene?: unknown; camera?: unknown; renderer?: unknown }): void;
  };
  worldService: {
    attachLegacy(handles: Record<string, unknown>): void;
  };
  worldHandles: {
    addStud: unknown;
    removeStud: unknown;
    createMesh(geometry: unknown, material: unknown): unknown;
    createGeometry(attributes: Record<string, { array: ArrayLike<number>; itemSize: number }>): unknown;
    scene: unknown;
    objects: unknown[];
    bufferGeometryUtils: unknown;
    shadowsActive: unknown;
  };
  cursorOver(element: Element | null | undefined): boolean;
};

export class EngineCompatibilityService {
  install(options: EngineCompatibilityOptions): EngineCompatibilityVortexApi {
    const windowRef = options.windowRef;
    windowRef._vortex = options.vortexApi;
    windowRef.THREE = options.three;
    windowRef.GLTFLoader = options.gltfLoaderClass;
    windowRef.gltfLoader = options.gltfLoader;
    windowRef.scene = options.scene;
    windowRef.ambient = options.ambient;
    windowRef.renderer = options.renderer;
    windowRef.objects = options.objects;
    windowRef.camera = options.camera;
    windowRef.cam = options.cam;
    windowRef._cursorOver = options.cursorOver;

    options.rendererService.attachLegacy({
      scene: options.scene,
      camera: options.camera,
      renderer: options.renderer
    });
    options.worldService.attachLegacy({
      ...options.worldHandles,
      setSpawn: options.vortexApi.setSpawn,
      pick: options.vortexApi.pick,
      getObjects: options.vortexApi.getObjects,
      getColliders: options.vortexApi.getColliders
    });

    const event = new CustomEvent("vortex-engine-ready", { detail: options.vortexApi });
    (options.detailTarget || windowRef).dispatchEvent(event);
    return options.vortexApi;
  }
}
