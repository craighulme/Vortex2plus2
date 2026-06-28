import { describe, expect, it } from "vitest";
import { RendererService } from "../renderer/RendererService";

describe("RendererService", () => {
  it("creates a WebGPU renderer through dependency-injected Three", async () => {
    const service = new RendererService();
    class FakeWebGpuRenderer {
      isWebGPURenderer = true;
      backend = { isWebGPUBackend: true };
      userData: { vwebBackend?: string } = {};
      initCalls = 0;
      constructor(readonly options: Record<string, unknown>) {}
      async init() {
        this.initCalls += 1;
      }
    }

    const renderer = await service.createWebGpuRenderer({ WebGPURenderer: FakeWebGpuRenderer });

    expect(renderer.userData?.vwebBackend).toBe("webgpu");
    expect(service.detectRendererBackend(renderer)).toBe("webgpu");
    expect(renderer).toMatchObject({
      options: { antialias: false, powerPreference: "high-performance" },
      initCalls: 1
    });
  });

  it("applies safe pixel ratio defaults and exposes renderer stats", () => {
    const renderer = {
      pixelRatio: 2,
      setPixelRatio(value: number) {
        this.pixelRatio = value;
      },
      getPixelRatio() {
        return this.pixelRatio;
      },
      isWebGPURenderer: true,
      backend: {
        isWebGPUBackend: true
      },
      userData: {
        vwebBackend: "webgpu"
      },
      capabilities: {
        maxTextureSize: 16384,
        maxTextures: 16,
        getMaxAnisotropy: () => 8
      },
      info: {
        render: { calls: 12, triangles: 3456 },
        memory: { geometries: 7, textures: 5 }
      },
      shadowMap: { enabled: false }
    };

    const service = new RendererService();
    service.attachLegacy({ renderer });

    expect(renderer.pixelRatio).toBe(1);
    expect(service.snapshot()).toMatchObject({
      attached: true,
      backend: "webgpu",
      webgpu: true,
      pixelRatio: 1,
      maxTextureSize: 16384,
      maxTextureUnits: 16,
      maxAnisotropy: 8,
      drawCalls: 12,
      triangles: 3456,
      geometries: 7,
      textures: 5,
      shadowsEnabled: false,
      shadowQuality: "medium",
      shadowMapSize: 2048,
      shadowCascades: 4
    });
  });

  it("honors the saved pixel ratio cap", () => {
    const originalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem(key: string) {
          return key === "vwebPixelRatioCap" ? "0.5" : null;
        }
      }
    });

    const renderer = {
      pixelRatio: 1,
      setPixelRatio(value: number) {
        this.pixelRatio = value;
      },
      getPixelRatio() {
        return this.pixelRatio;
      }
    };

    const service = new RendererService();
    service.attachLegacy({ renderer });

    expect(renderer.pixelRatio).toBe(0.5);

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: originalStorage
    });
  });

  it("stores shadow quality through the renderer service", () => {
    const originalStorage = globalThis.localStorage;
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem(key: string) {
          return values.get(key) ?? null;
        },
        setItem(key: string, value: string) {
          values.set(key, value);
        }
      }
    });

    const service = new RendererService();
    expect(service.getShadowConfig()).toMatchObject({ quality: "medium", mapSize: 2048, cascades: 4 });
    expect(service.setShadowQuality("ultra")).toMatchObject({ quality: "ultra", mapSize: 4096, cascades: 4 });
    expect(service.setShadowQuality("nonsense")).toMatchObject({ quality: "medium", mapSize: 2048, cascades: 4 });

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: originalStorage
    });
  });

  it("owns tone mapping selection and material invalidation", () => {
    const originalStorage = globalThis.localStorage;
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem(key: string) {
          return values.get(key) ?? null;
        },
        setItem(key: string, value: string) {
          values.set(key, value);
        }
      }
    });

    const renderer = { toneMapping: null as unknown };
    const material = { needsUpdate: false };
    const arrayMaterial = [{ needsUpdate: false }, { needsUpdate: false }];
    const scene = {
      traverse(visitor: (object: { material?: typeof material | typeof arrayMaterial }) => void) {
        visitor({ material });
        visitor({ material: arrayMaterial });
      }
    };

    const service = new RendererService();
    expect(service.applyToneMapping({
      renderer,
      THREE: { AgXToneMapping: "agx-tone", ACESFilmicToneMapping: "aces-tone", NoToneMapping: "none-tone" },
      mode: "aces"
    })).toBe("aces");
    expect(renderer.toneMapping).toBe("aces-tone");

    expect(service.setToneMappingMode("agx", {
      renderer,
      THREE: { AgXToneMapping: "agx-tone", NoToneMapping: "none-tone" },
      scene
    })).toBe("agx");
    expect(values.get("vwebToneMapping")).toBe("agx");
    expect(renderer.toneMapping).toBe("agx-tone");
    expect(material.needsUpdate).toBe(true);
    expect(arrayMaterial.every((item) => item.needsUpdate)).toBe(true);

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: originalStorage
    });
  });

  it("owns fog settings and scene diagnostics", () => {
    const originalStorage = globalThis.localStorage;
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem(key: string) {
          return values.get(key) ?? null;
        },
        setItem(key: string, value: string) {
          values.set(key, value);
        }
      }
    });

    class FakeFog {
      constructor(
        readonly color: number,
        readonly near: number,
        readonly far: number
      ) {}
    }

    const darkMaterial = {
      type: "MeshStandardMaterial",
      needsUpdate: false,
      color: { r: 0, g: 0, b: 0, getHexString: () => "000000" }
    };
    const scene = {
      fog: null as unknown,
      traverse(visitor: (object: unknown) => void) {
        visitor({ isLight: true, type: "DirectionalLight" });
        visitor({
          uuid: "mesh-1",
          name: "dark-part",
          type: "Mesh",
          isMesh: true,
          visible: true,
          castShadow: true,
          receiveShadow: true,
          geometry: {
            boundingBox: {
              min: { x: -10, y: 0, z: -20 },
              max: { x: 30, y: 4, z: 80 }
            },
            boundingSphere: { radius: 60 },
            index: { count: 300 },
            attributes: { position: { count: 180 } }
          },
          userData: { vwebRuntimeKind: "world-map-batch", vwebMapName: "Test Map", vwebBatchKey: "batch-a" },
          material: darkMaterial
        });
      }
    };

    const service = new RendererService();
    expect(service.applyFog({ scene, THREE: { Fog: FakeFog } })).toMatchObject({ enabled: false, far: 900 });
    expect(scene.fog).toBeNull();

    expect(service.setFogEnabled(true, { scene, THREE: { Fog: FakeFog } })).toMatchObject({ enabled: true });
    expect(scene.fog).toMatchObject({ near: 378, far: 900 });

    expect(service.setFogDistance(1200, { scene, THREE: { Fog: FakeFog } })).toMatchObject({ enabled: true, near: 504, far: 1200 });
    expect(values.get("vwebFogDistance")).toBe("1200");

    const diagnostics = service.diagnoseScene({ scene });
    expect(diagnostics.scene).toMatchObject({
      objects: 2,
      meshes: 1,
      visibleMeshes: 1,
      lights: 1,
      materials: 1,
      darkMaterials: 1,
      blackMaterials: 1,
      byKind: {
        light: {
          objects: 1
        },
        "world-map-batch": {
          meshes: 1,
          materials: 1,
          darkMaterials: 1,
          blackMaterials: 1
        }
      }
    });
    expect(diagnostics.darkSamples[0]).toMatchObject({ kind: "world-map-batch", object: "dark-part", color: "#000000" });
    expect(diagnostics.worldBatches[0]).toMatchObject({
      kind: "world-map-batch",
      uuid: "mesh-1",
      mapName: "Test Map",
      batchKey: "batch-a",
      color: "#000000",
      footprint: 4000,
      vertices: 180,
      triangles: 100,
      radius: 60,
      bounds: {
        size: { x: 40, y: 4, z: 100 },
        center: { x: 10, y: 2, z: 30 }
      }
    });

    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: originalStorage
    });
  });
});
