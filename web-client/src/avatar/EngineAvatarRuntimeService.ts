type ThreeLike = Record<string, any>;

type AnimationState = {
  time: number;
  bones: Record<string, unknown>;
  rest: Record<string, unknown>;
};

type CharacterMetrics = {
  halfWidth: number;
  halfDepth: number;
  height: number;
  footOffset: number;
  standY: number;
};

export type EngineAvatarRuntimeOptions = {
  THREE: ThreeLike;
  scene: unknown;
  document: Document;
  windowRef: Window & Record<string, any>;
  loader: unknown;
  avatarService: any;
  avatarAssets: any;
  avatarMaterials: any;
  localAvatar: any;
  remoteAvatarAppearance: any;
  characterSpawn: any;
  animation: AnimationState;
  isWebGpuRuntime: boolean;
  floorY: number;
  footOffset?: number;
  resolveAsset(bodyType: "male" | "female"): string;
  shadowsActive(): boolean;
  markShadowsDirty(): void;
};

export type EngineAvatarRuntimeHandles = {
  avatarMaterials: any;
  avatarAssets: any;
  avatarService: any;
  characterSpawn: any;
  localAvatar: any;
  remoteAvatarAppearance: any;
  getCharacter(): any;
  getMetrics(): CharacterMetrics;
  getCharHeight(): number;
  getCharFootOffset(): number;
  getCharStandY(): number;
};

export class EngineAvatarRuntimeService {
  configure(options: EngineAvatarRuntimeOptions): EngineAvatarRuntimeHandles {
    const avatarMaterials = options.avatarMaterials.configure?.({
      THREE: options.THREE,
      window: options.windowRef,
      document: options.document
    });
    if (!avatarMaterials) {
      throw new Error("[avatar] VortexRuntime avatar material service is required before the engine starts.");
    }
    if (!options.avatarAssets) {
      throw new Error("[avatar] VortexRuntime avatar asset service is required before the engine starts.");
    }
    if (!options.avatarService) {
      throw new Error("[avatar] VortexRuntime avatar service is required before the engine starts.");
    }
    if (!options.characterSpawn) {
      throw new Error("[avatar] VortexRuntime character spawn service is required before the engine starts.");
    }

    const footOffset = options.footOffset ?? 2.0;
    let character: any = null;
    let charStandY = options.floorY + footOffset;
    let charHeight = 5;
    const charHalfWidth = 1;
    const charHalfDepth = 0.5;

    const localAvatar = options.localAvatar.configure?.({
      THREE: options.THREE,
      scene: options.scene,
      loader: options.loader,
      windowRef: options.windowRef,
      avatarService: options.avatarService,
      avatarAssets: options.avatarAssets,
      avatarMaterials,
      animation: options.animation,
      isWebGpuRuntime: options.isWebGpuRuntime,
      getSpawn: () => options.characterSpawn.getSpawn(),
      getFootOffset: () => footOffset,
      getStandY: () => options.floorY + footOffset,
      resolveAsset: options.resolveAsset,
      shadowsActive: options.shadowsActive,
      onCharacterChanged: (nextCharacter: any) => {
        character = nextCharacter;
      },
      onMetricsChanged: ({ height, standY }: { height: number; standY: number }) => {
        charHeight = height;
        charStandY = standY;
      },
      onShadowsDirty: options.markShadowsDirty,
      onRendererChanged: () => {
        options.windowRef.dispatchEvent(new CustomEvent("vweb-character-renderer-changed", { detail: { renderer: "modern" } }));
      },
      isDebugEnabled: () => !!options.windowRef.VortexAvatarDebug
    });
    if (!localAvatar) {
      throw new Error("[avatar] VortexRuntime local avatar service is required before the engine starts.");
    }

    const remoteAvatarAppearance = options.remoteAvatarAppearance.configure?.({
      avatarService: options.avatarService,
      avatarAssets: options.avatarAssets,
      avatarMaterials,
      isWebGpuRuntime: options.isWebGpuRuntime,
      isDebugEnabled: () => !!options.windowRef.VortexAvatarDebug
    });
    if (!remoteAvatarAppearance) {
      throw new Error("[avatar] VortexRuntime remote avatar appearance service is required before the engine starts.");
    }

    localAvatar.reload();

    return {
      avatarMaterials,
      avatarAssets: options.avatarAssets,
      avatarService: options.avatarService,
      characterSpawn: options.characterSpawn,
      localAvatar,
      remoteAvatarAppearance,
      getCharacter: () => character,
      getMetrics: () => ({
        halfWidth: charHalfWidth,
        halfDepth: charHalfDepth,
        height: charHeight,
        footOffset,
        standY: charStandY
      }),
      getCharHeight: () => charHeight,
      getCharFootOffset: () => footOffset,
      getCharStandY: () => charStandY
    };
  }
}
