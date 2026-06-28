import { describe, expect, it } from "vitest";
import { SceneSettingsService } from "../renderer/SceneSettingsService";

describe("SceneSettingsService", () => {
  it("owns runtime fog and tone mapping state", () => {
    const markedRoots: unknown[] = [];
    const scene = { id: "scene" };
    const renderer = { id: "renderer" };
    const THREE = { id: "three" };

    const service = new SceneSettingsService();
    service.configure({
      scene,
      renderer,
      THREE,
      rendererService: {
        applyFog(options) {
          expect(options).toMatchObject({ scene, THREE });
          return { enabled: false, near: 378, far: 900 };
        },
        applyToneMapping(options) {
          expect(options).toMatchObject({ renderer, THREE, mode: "none" });
          return "none";
        },
        markMaterialsForUpdate(root) {
          markedRoots.push(root);
        },
        setToneMappingMode(mode, options) {
          expect(options).toMatchObject({ renderer, THREE, scene });
          return mode;
        },
        setFogEnabled(enabled, options) {
          expect(options).toMatchObject({ scene, THREE });
          return { enabled, near: 378, far: 900 };
        },
        setFogDistance(distance, options) {
          expect(options).toMatchObject({ scene, THREE });
          return { enabled: true, near: 504, far: distance };
        },
        getToneMappingMode() {
          return "none";
        }
      }
    });

    expect(service.snapshot()).toEqual({
      fog: { enabled: false, near: 378, far: 900 },
      toneMapping: "none"
    });

    expect(service.setToneMappingMode("agx")).toBe("agx");
    expect(service.readToneMappingMode()).toBe("agx");

    expect(service.setRenderFog(true)).toEqual({ enabled: true, near: 378, far: 900 });
    expect(service.setFogDistance(1200)).toEqual({ enabled: true, near: 504, far: 1200 });
    expect(markedRoots).toEqual([scene, scene]);
  });
});
