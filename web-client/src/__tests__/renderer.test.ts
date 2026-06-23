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
      capabilities: {
        isWebGL2: true,
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
      pixelRatio: 1,
      webgl2: true,
      maxTextureSize: 16384,
      maxTextureUnits: 16,
      maxAnisotropy: 8,
      drawCalls: 12,
      triangles: 3456,
      geometries: 7,
      textures: 5,
      shadowsEnabled: false
    });
  });
});
