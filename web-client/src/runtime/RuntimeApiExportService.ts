import type { RemotePlayerRuntimeApi } from "../avatar/remote/RemotePlayerTypes";
import type { WorldDynamicAdapter } from "../world/WorldDynamicObjectService";

export type RuntimeApi = RemotePlayerRuntimeApi & {
  getGrounded(): boolean;
  getVelY(): number;
  setVelY(value: unknown): unknown;
  setGrounded(value: unknown): unknown;
  getMovementConstants(): unknown;
  getMovementMods(): unknown;
  setMovementMods(patch: unknown): unknown;
  getCameraState(): unknown;
  getClimbState(): unknown;
  getSpawn(): unknown;
  getFootIkState(): unknown;
  keys: Record<string, boolean>;
  setSens(multiplier: unknown): unknown;
  getShadowsEnabled(): boolean;
  setShadowsEnabled(value: unknown): unknown;
  requestLock(): void;
  resetCharacter(): boolean;
  pick(): unknown;
  getObjects(): unknown[];
  getColliders(): unknown[];
  getCamera(): unknown;
  getCharBubbleBase(): number;
  setSpawn(x: number, y: number, z: number, ry?: number): void;
  applyShirt(url: string): void;
  applyShirtToMesh(mesh: unknown, url: string): void;
  applyBodyColors(target: unknown, colors: unknown): void;
  prepareModernAvatarMaterials(target: unknown): void;
  prefetchAvatarImages(avatars: unknown): unknown;
  applyAvatar(avatar: unknown): Promise<void>;
  getAvatar(): unknown;
};

export type RuntimeApiExportOptions = {
  windowRef: Window & Record<string, unknown>;
  detailTarget?: EventTarget;
  three: unknown;
  scene: unknown;
  renderer: unknown;
  camera: unknown;
  runtimeApi: RuntimeApi;
  setRuntimeApi(value: RuntimeApi): void;
  rendererService: {
    attachRuntimeAdapter(handles: { three?: unknown; scene?: unknown; camera?: unknown; renderer?: unknown }): void;
  };
  worldService: {
    attachRuntimeAdapter(handles: Record<string, unknown>): void;
  };
  worldHandles: WorldDynamicAdapter;
};

export class RuntimeApiExportService {
  install(options: RuntimeApiExportOptions): RuntimeApi {
    options.rendererService.attachRuntimeAdapter({
      three: options.three,
      scene: options.scene,
      camera: options.camera,
      renderer: options.renderer
    });
    options.setRuntimeApi(options.runtimeApi);
    options.worldService.attachRuntimeAdapter({
      ...options.worldHandles,
      setSpawn: options.runtimeApi.setSpawn,
      pick: options.runtimeApi.pick,
      getObjects: options.runtimeApi.getObjects,
      getColliders: options.runtimeApi.getColliders
    });

    const target = options.detailTarget || options.windowRef;
    target.dispatchEvent(new CustomEvent("vweb-runtime-exports-ready", { detail: options.runtimeApi }));
    return options.runtimeApi;
  }
}
