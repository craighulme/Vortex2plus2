import { describe, expect, it } from "vitest";
import { RendererService } from "../renderer/RendererService";

describe("RendererService", () => {
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
        v22Backend: "webgpu"
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
          return key === "v22PixelRatioCap" ? "0.5" : null;
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
});
