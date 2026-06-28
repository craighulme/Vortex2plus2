import type { AvatarAssetService } from "../avatar/AvatarAssetService";
import type { AvatarMaterialService } from "../avatar/AvatarMaterialService";
import type { CharacterSpawnService } from "../avatar/CharacterSpawnService";
import type { LocalAvatarService } from "../avatar/LocalAvatarService";
import type { RemoteAvatarAppearanceService } from "../avatar/RemoteAvatarAppearanceService";
import type { CameraService } from "../camera/CameraService";
import type { LocalMovementRuntimeService } from "../movement/LocalMovementRuntimeService";
import type { QualityService } from "../renderer/QualityService";
import type { RendererService } from "../renderer/RendererService";
import type { SceneSettingsService } from "../renderer/SceneSettingsService";
import type { FrameLoopService } from "./FrameLoopService";
import type { EngineCompatibilityService, EngineCompatibilityVortexApi } from "./EngineCompatibilityService";

type ThreeLike = {
  Mesh: new (geometry: unknown, material: unknown) => unknown;
  BufferGeometry: new () => {
    setAttribute(name: string, attribute: unknown): void;
  };
  Float32BufferAttribute: new (array: ArrayLike<number>, itemSize: number) => unknown;
};

type WorldRuntimeLike = {
  textureService: { snapshot(): { textures: number }; setStudTextures(value: boolean): void };
  geometryService: { snapshot(): { geometries: number } };
  materialService: { snapshot(): { materials: number } };
  partService: { snapshot(): unknown };
  objects: unknown[];
  colliders: unknown[];
  addStud: unknown;
  removeStud: unknown;
  useStudTextures(): boolean;
  refreshStudMaterialTextures(): void;
  textureDiagnostics(): unknown;
};

type EngineRuntimeBridgeConfig = {
  windowRef: Window & Record<string, unknown>;
  localStorage: Storage;
  three: ThreeLike & Record<string, unknown>;
  gltfLoaderClass: unknown;
  gltfLoader: unknown;
  scene: unknown;
  ambient: unknown;
  renderer: { render(scene: unknown, camera: unknown): void; getPixelRatio(): number; userData?: Record<string, unknown> };
  cameraObject: unknown;
  cameraState: unknown;
  avatarMaterials: AvatarMaterialService;
  avatarAssets: AvatarAssetService;
  localAvatar: LocalAvatarService;
  remoteAvatarAppearance: RemoteAvatarAppearanceService;
  characterSpawn: CharacterSpawnService;
  localMovement: LocalMovementRuntimeService;
  camera: CameraService;
  animation: { getFootIkState(): unknown };
  shadows: { snapshot(): unknown; markNeedsUpdate(): void };
  shadowQuality(): string;
  shadowMapSize(): number;
  shadowsActive(): boolean;
  setShadowsEnabled(value: unknown): unknown;
  setShadowQuality(value: unknown): unknown;
  sceneSettings: SceneSettingsService;
  rendererService: RendererService;
  quality: QualityService;
  compatibility: EngineCompatibilityService;
  frameLoop: FrameLoopService;
  profiler: { begin(now: number): unknown; mark(frame: unknown, label: string): void; end(frame: unknown): void };
  worldService: {
    attachLegacy(handles: Record<string, unknown>): void;
    renderChunkSnapshot?(): unknown;
    setRenderDistance?(distance: number, profile?: "performance" | "balanced" | "visual"): unknown;
  };
  worldRuntime: WorldRuntimeLike;
  bufferGeometryUtils: unknown;
  keys: Record<string, boolean>;
  anim: { rest: unknown };
  getCharacter(): { position: { y: number } } | null;
  getCharHeight(): number;
  getCharFootOffset(): number;
  getCharStandY(): number;
  readStorageFlag(key: string, fallback?: boolean): boolean;
  requestPointerLock(): void;
  resetCharacterToSpawn(): boolean;
  pick(): unknown;
  cursorOver(element: Element | null | undefined): boolean;
  update(dt: number): void;
  updateCamera(dt: number): void;
  updateDebug(): void;
  updateLighting(dt: number): void;
};

export class EngineRuntimeBridgeService {
  install(config: EngineRuntimeBridgeConfig): EngineCompatibilityVortexApi {
    const vortexApi = this.createVortexApi(config);
    config.windowRef.VortexQuality = config.quality.configureRuntime({
      windowRef: config.windowRef,
      localStorage: config.localStorage,
      renderer: config.renderer,
      scene: config.scene as never,
      shadows: config.shadows,
      rendererService: config.rendererService,
      toneMappingMode: () => config.sceneSettings.readToneMappingMode(),
      fogSettings: () => config.sceneSettings.readFogSettings(),
      shadowQuality: config.shadowQuality,
      shadowMapSize: config.shadowMapSize,
      shadowsActive: config.shadowsActive,
      readStorageFlag: config.readStorageFlag,
      useStudTextures: config.worldRuntime.useStudTextures,
      textureDiagnostics: config.worldRuntime.textureDiagnostics,
      caches: () => ({
        geometries: config.worldRuntime.geometryService.snapshot().geometries,
        materials: config.worldRuntime.materialService.snapshot().materials,
        textures: config.worldRuntime.textureService.snapshot().textures,
        parts: config.worldRuntime.partService.snapshot(),
        renderChunks: config.worldService.renderChunkSnapshot?.() || null
      }),
      setShadows: config.setShadowsEnabled,
      setShadowQuality: config.setShadowQuality,
      setToneMapping: (value) => config.sceneSettings.setToneMappingMode(String(value)),
      setRenderFog: (value) => config.sceneSettings.setRenderFog(Boolean(value)),
      setFogDistance: (value) => config.sceneSettings.setFogDistance(Number(value)),
      setRenderDistance: (value, profile) => config.worldService.setRenderDistance?.(Number(value), profile),
      setStudTexturesEnabled: (value) => config.worldRuntime.textureService.setStudTextures(!!value),
      refreshMaterials: () => {
        config.worldRuntime.refreshStudMaterialTextures();
        config.sceneSettings.markMaterialsForShaderUpdate();
      },
      diagnoseSceneInput: () => ({
        scene: config.scene,
        renderer: config.renderer,
        shadows: config.shadows,
        toneMappingMode: config.sceneSettings.readToneMappingMode()
      })
    });

    config.compatibility.install({
      windowRef: config.windowRef,
      three: config.three,
      gltfLoaderClass: config.gltfLoaderClass,
      gltfLoader: config.gltfLoader,
      scene: config.scene,
      ambient: config.ambient,
      renderer: config.renderer,
      objects: config.worldRuntime.objects,
      camera: config.cameraObject,
      cam: config.cameraState,
      vortexApi,
      rendererService: config.rendererService,
      worldService: config.worldService,
      worldHandles: {
        addStud: config.worldRuntime.addStud,
        removeStud: config.worldRuntime.removeStud,
        createMesh: (geometry, material) => new config.three.Mesh(geometry, material),
        createGeometry: (attributes) => {
          const geometry = new config.three.BufferGeometry();
          for (const [name, attribute] of Object.entries(attributes || {})) {
            geometry.setAttribute(name, new config.three.Float32BufferAttribute(attribute.array, attribute.itemSize));
          }
          return geometry;
        },
        scene: config.scene,
        objects: config.worldRuntime.objects,
        bufferGeometryUtils: config.bufferGeometryUtils,
        shadowsActive: config.shadowsActive
      },
      cursorOver: config.cursorOver
    });

    config.frameLoop.start({
      windowRef: config.windowRef,
      profiler: config.profiler,
      callbacks: {
        update: config.update,
        camera: config.updateCamera,
        debug: config.updateDebug,
        multiplayer: (dt) => (config.windowRef._mpUpdate as ((dt: number) => void) | undefined)?.(dt),
        lighting: config.updateLighting,
        render: () => config.renderer.render(config.scene, config.cameraObject)
      }
    });
    return vortexApi;
  }

  private createVortexApi(config: EngineRuntimeBridgeConfig): EngineCompatibilityVortexApi {
    return {
      scene: config.scene,
      getCharacter: config.getCharacter,
      getGrounded: () => config.localMovement.getGrounded(),
      getVelY: () => config.localMovement.getVelY(),
      setVelY: (value: unknown) => config.localMovement.setVelY(value),
      setGrounded: (value: unknown) => config.localMovement.setGrounded(value),
      getMovementConstants: () => config.localMovement.constants(),
      getMovementMods: () => config.localMovement.getMovementMods(),
      setMovementMods: (patch: unknown) => config.localMovement.setMovementMods(patch as never),
      getCameraState: () => config.camera.snapshot(),
      getClimbState: () => config.localMovement.getClimbState(),
      getCharFootOffset: config.getCharFootOffset,
      getCharHeight: config.getCharHeight,
      getSpawn: () => config.characterSpawn.getSpawn(),
      getAnimRest: () => config.anim.rest,
      getFootIkState: () => config.animation.getFootIkState(),
      keys: config.keys,
      setSens: (multiplier: unknown) => config.camera.setSensitivity(multiplier),
      getShadowsEnabled: () => config.shadowsActive(),
      setShadowsEnabled: (value: unknown) => config.setShadowsEnabled(value),
      requestLock: () => config.requestPointerLock(),
      resetCharacter: () => config.resetCharacterToSpawn(),
      pick: () => config.pick(),
      getObjects: () => config.worldRuntime.objects,
      getColliders: () => config.worldRuntime.colliders,
      getCamera: () => config.cameraObject,
      getCharBubbleBase: () => {
        const character = config.getCharacter();
        return character ? character.position.y + config.getCharHeight() - config.getCharFootOffset() + 0.4 : 0;
      },
      setSpawn: (x: number, y: number, z: number, ry = Math.PI) => {
        console.log(`set spawn to: ${x} ${y} ${z}`);
        config.characterSpawn.setSpawn(x, y, z, ry);
        config.characterSpawn.applyToCharacter(config.getCharacter() as never, {
          footOffset: config.getCharFootOffset(),
          standY: config.getCharStandY()
        });
      },
      applyShirt: (url: string) => {
        config.avatarMaterials.applyShirtToMesh(config.localAvatar.getShirtMesh(), url);
      },
      applyShirtToMesh: (mesh: unknown, url: string) => {
        config.remoteAvatarAppearance.applyShirtToMesh(mesh, url);
      },
      buildShirtOverlay: (target: unknown) => config.remoteAvatarAppearance.buildShirtOverlay(target),
      buildPantsOverlay: (target: unknown) => config.remoteAvatarAppearance.buildPantsOverlay(target),
      buildFaceOverlay: (target: unknown) => config.remoteAvatarAppearance.buildFaceOverlay(target),
      applyBodyColors: (target: unknown, colors: unknown) => config.remoteAvatarAppearance.applyBodyColors(target, Array.isArray(colors) ? colors.map(String) : []),
      prepareModernAvatarMaterials: (target: unknown) => config.remoteAvatarAppearance.prepareModernAvatarMaterials(target),
      prefetchAvatarImages: (avatars: unknown) => config.avatarAssets.prefetchAvatarImages((Array.isArray(avatars) ? avatars : [avatars]) as Array<Record<string, unknown>>),
      applyAvatar: async (avatar: unknown) => {
        await config.localAvatar.applyAvatar(isRecord(avatar) ? avatar : {});
      },
      applyAvatarToMeshes: async (meshes: unknown, avatar: unknown) => {
        await config.remoteAvatarAppearance.applyAvatarToMeshes(meshes as never, isRecord(avatar) ? avatar : {});
      },
      getAvatar: () => config.localAvatar.getAvatar()
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
