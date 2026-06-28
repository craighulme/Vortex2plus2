import { describe, expect, it } from "vitest";
import { EngineRuntimeBridgeService } from "../runtime/EngineRuntimeBridgeService";

describe("EngineRuntimeBridgeService", () => {
  it("installs quality, compatibility, frame loop, and vortex api", () => {
    const windowRef = { requestAnimationFrame: () => 0 } as unknown as Window & Record<string, unknown>;
    const localMovement = {
      getGrounded: () => true,
      getVelY: () => 4,
      setVelY: () => {},
      setGrounded: () => {},
      constants: () => ({ WALK_SPEED: 16, JUMP_POWER: 50, GRAVITY: -196.2 }),
      getMovementMods: () => ({ fly: false }),
      setMovementMods: () => ({ fly: true }),
      getClimbState: () => "none"
    };
    const compatibility = {
      installed: null as unknown,
      install(options: unknown) {
        this.installed = options;
        (options as { windowRef: Record<string, unknown>; vortexApi: unknown }).windowRef._vortex = (options as { vortexApi: unknown }).vortexApi;
        return (options as { vortexApi: unknown }).vortexApi;
      }
    };
    const frameLoop = {
      started: null as unknown,
      start(options: unknown) {
        this.started = options;
      }
    };
    const quality = {
      configured: null as unknown,
      configureRuntime(options: unknown) {
        this.configured = options;
        return this;
      }
    };
    const character = { position: { y: 10 } };

    const api = new EngineRuntimeBridgeService().install({
      windowRef,
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } as unknown as Storage,
      three: {
        Mesh: class {},
        BufferGeometry: class { setAttribute() {} },
        Float32BufferAttribute: class {}
      } as any,
      gltfLoaderClass: class {},
      gltfLoader: {},
      scene: {},
      ambient: {},
      renderer: { render: () => {}, getPixelRatio: () => 1, userData: { vwebBackend: "webgpu" } },
      cameraObject: {},
      cameraState: {},
      avatarMaterials: { applyShirtToMesh: () => {} } as any,
      avatarAssets: { prefetchAvatarImages: () => {} } as any,
      localAvatar: { getShirtMesh: () => ({}), applyAvatar: async () => {}, getAvatar: () => ({}) } as any,
      remoteAvatarAppearance: {
        applyShirtToMesh: () => {},
        buildShirtOverlay: () => ({}),
        buildPantsOverlay: () => ({}),
        buildFaceOverlay: () => ({}),
        applyBodyColors: () => {},
        prepareModernAvatarMaterials: () => ({}),
        applyAvatarToMeshes: async () => {}
      } as any,
      characterSpawn: {
        getSpawn: () => ({ x: 1 }),
        setSpawn: () => {},
        applyToCharacter: () => {}
      } as any,
      localMovement: localMovement as any,
      camera: { snapshot: () => ({ yaw: 1 }), setSensitivity: () => {} } as any,
      animation: { getFootIkState: () => ({ active: false }) },
      shadows: { snapshot: () => ({}), markNeedsUpdate: () => {} },
      shadowQuality: () => "medium",
      shadowMapSize: () => 2048,
      shadowsActive: () => false,
      setShadowsEnabled: () => false,
      setShadowQuality: () => ({}),
      sceneSettings: {
        readToneMappingMode: () => "none",
        readFogSettings: () => ({}),
        setToneMappingMode: () => "none",
        setRenderFog: () => ({}),
        setFogDistance: () => ({}),
        markMaterialsForShaderUpdate: () => {}
      } as any,
      rendererService: { detectRendererBackend: () => "webgpu", diagnoseScene: () => ({}) } as any,
      quality: quality as any,
      compatibility: compatibility as any,
      frameLoop: frameLoop as any,
      profiler: { begin: () => ({}), mark: () => {}, end: () => {} },
      worldService: { attachLegacy: () => {} },
      worldRuntime: {
        textureService: { snapshot: () => ({ textures: 1 }), setStudTextures: () => {} },
        geometryService: { snapshot: () => ({ geometries: 1 }) },
        materialService: { snapshot: () => ({ materials: 1 }) },
        partService: { snapshot: () => ({}) },
        objects: [],
        colliders: [],
        addStud: () => {},
        removeStud: () => {},
        useStudTextures: () => true,
        refreshStudMaterialTextures: () => {},
        textureDiagnostics: () => []
      },
      bufferGeometryUtils: {},
      keys: {},
      anim: { rest: {} },
      getCharacter: () => character,
      getCharHeight: () => 5,
      getCharFootOffset: () => 2,
      getCharStandY: () => 3.5,
      readStorageFlag: () => false,
      requestPointerLock: () => {},
      resetCharacterToSpawn: () => true,
      pick: () => "hit",
      cursorOver: () => false,
      update: () => {},
      updateCamera: () => {},
      updateDebug: () => {},
      updateLighting: () => {}
    });

    const apiMethods = api as {
      getGrounded: () => boolean;
      getVelY: () => number;
      pick: () => unknown;
      getCharBubbleBase: () => number;
    };

    expect(apiMethods.getGrounded).toBeDefined();
    expect(apiMethods.getVelY()).toBe(4);
    expect(apiMethods.pick()).toBe("hit");
    expect(apiMethods.getCharBubbleBase()).toBe(13.4);
    expect(windowRef._vortex).toBe(api);
    expect(quality.configured).toBeTruthy();
    expect(compatibility.installed).toBeTruthy();
    expect(frameLoop.started).toBeTruthy();
  });
});
