import type { RuntimeAssetResolverService } from "../assets/RuntimeAssetResolverService";

type ThreeLike = Record<string, any>;

type CharacterDebugMetrics = {
  halfWidth: number;
  halfDepth: number;
  height: number;
  footOffset: number;
};

export type EngineWorldRuntimeOptions = {
  THREE: ThreeLike;
  scene: unknown;
  renderer: unknown;
  windowRef: Window & Record<string, any>;
  assets: unknown;
  assetResolver: RuntimeAssetResolverService;
  fallbackAssetRaw?: string | null;
  worldRuntime: any;
  textures: unknown;
  geometry: unknown;
  materials: unknown;
  colliders: unknown;
  parts: unknown;
  sceneSettings: unknown;
  shadows: unknown;
  debugVisuals: any;
  worldPicking: any;
  cursor: { position(): { x: number; y: number } };
  camera: unknown;
  studsPerTile: number;
};

export type EngineWorldRuntimeHandles = {
  debugVisuals: any;
  worldRuntime: any;
  objects: unknown[];
  runtimeAsset(path: string, fallbackKey?: string | null): string | null;
  getNearbyColliders(px: number, py: number, pz: number): Set<unknown>;
  getClicked3DPoint(): unknown;
  useStudTextures(): boolean;
  refreshStudMaterialTextures(): void;
  toggleDebug(metrics: CharacterDebugMetrics): void;
  updateDebug(character: unknown, metrics: CharacterDebugMetrics): void;
};

export class EngineWorldRuntimeService {
  configure(options: EngineWorldRuntimeOptions): EngineWorldRuntimeHandles {
    if (!options.assets) {
      throw new Error("[assets] VortexRuntime asset manager is required before the engine starts.");
    }

    const resolver = options.assetResolver.configure({
      assets: options.assets as never,
      ...(options.fallbackAssetRaw === undefined ? {} : { fallbackRaw: options.fallbackAssetRaw })
    });
    const runtimeAsset = (path: string, fallbackKey: string | null = null): string | null => resolver.resolve(path, fallbackKey);

    let worldRuntimeHandles: any = null;
    const getNearbyColliders = (px: number, py: number, pz: number): Set<unknown> => {
      return worldRuntimeHandles?.getNearbyColliders(px, py, pz) || new Set();
    };

    const debugVisuals = options.debugVisuals.configure?.({
      THREE: options.THREE,
      scene: options.scene,
      getNearbyColliders,
      getColliderSnapshot: () => worldRuntimeHandles?.colliderService?.snapshot?.() || { colliders: 0, chunks: 0, chunkSize: 4 },
      worldToChunk: (value: number) => worldRuntimeHandles?.colliderService?.worldToChunk?.(value) || 0
    });
    if (!debugVisuals) {
      throw new Error("[diagnostics] VortexRuntime debug visual service is required before the engine starts.");
    }

    worldRuntimeHandles = options.worldRuntime.configure?.({
      THREE: options.THREE,
      scene: options.scene,
      renderer: options.renderer,
      textures: options.textures,
      geometry: options.geometry,
      materials: options.materials,
      colliders: options.colliders,
      parts: options.parts,
      sceneSettings: options.sceneSettings,
      shadows: options.shadows,
      studsPerTile: options.studsPerTile,
      runtimeAsset
    });
    if (!worldRuntimeHandles) {
      throw new Error("[world] VortexRuntime world runtime service is required before the engine starts.");
    }

    const pickingService = options.worldPicking.configure?.(options.THREE);
    if (!pickingService) {
      throw new Error("[world] VortexRuntime world picking service is required before the engine starts.");
    }

    return {
      debugVisuals,
      worldRuntime: worldRuntimeHandles,
      objects: worldRuntimeHandles.objects,
      runtimeAsset,
      getNearbyColliders,
      getClicked3DPoint: () => {
        const cursor = options.cursor.position();
        return pickingService.pick(
          options.camera,
          worldRuntimeHandles.objects,
          cursor.x,
          cursor.y,
          options.windowRef.innerWidth,
          options.windowRef.innerHeight
        );
      },
      useStudTextures: worldRuntimeHandles.useStudTextures,
      refreshStudMaterialTextures: worldRuntimeHandles.refreshStudMaterialTextures,
      toggleDebug: (metrics) => {
        debugVisuals.toggle({ charHalfW: metrics.halfWidth, charHalfD: metrics.halfDepth, charHeight: metrics.height });
      },
      updateDebug: (character, metrics) => {
        debugVisuals.update(character, {
          charHalfW: metrics.halfWidth,
          charHalfD: metrics.halfDepth,
          charHeight: metrics.height,
          charFootOffset: metrics.footOffset
        });
      }
    };
  }
}
