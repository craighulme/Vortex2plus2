import { describe, expect, it } from "vitest";
import { QualityService } from "../renderer/QualityService";

describe("QualityService", () => {
  it("delegates the public quality API to configured renderer callbacks", () => {
    const calls: string[] = [];
    const service = new QualityService().configure({
      get: () => ({ pixelRatio: 1 }),
      setShadows: (value) => calls.push(`shadows:${String(value)}`),
      setShadowQuality: (value) => calls.push(`shadowQuality:${String(value)}`),
      recoverMaterials: () => calls.push("recover"),
      setStudTextures: (value) => calls.push(`studs:${String(value)}`),
      diagnoseTextures: () => "textures",
      setToneMapping: (mode) => calls.push(`tone:${String(mode)}`),
      setRenderFog: (value) => calls.push(`fog:${String(value)}`),
      setFogDistance: (value) => calls.push(`fogDistance:${String(value)}`),
      setRenderDistance: (value, profile) => calls.push(`renderDistance:${String(value)}:${String(profile)}`),
      diagnoseScene: () => "scene",
      performance: () => "performance",
      visual: () => "visual"
    });

    expect(service.get()).toEqual({ pixelRatio: 1 });
    service.setShadows(true);
    service.setShadowQuality("high");
    service.recoverMaterials();
    service.setStudTextures(false);
    service.setToneMapping("none");
    service.setRenderFog(false);
    service.setFogDistance(4000);
    service.setRenderDistance(900, "performance");
    expect(service.diagnoseTextures()).toBe("textures");
    expect(service.diagnoseScene()).toBe("scene");
    expect(service.performance()).toBe("performance");
    expect(service.visual()).toBe("visual");
    expect(calls).toEqual([
      "shadows:true",
      "shadowQuality:high",
      "recover",
      "studs:false",
      "tone:none",
      "fog:false",
      "fogDistance:4000",
      "renderDistance:900:performance"
    ]);
  });

  it("builds the runtime quality API from engine service handles", () => {
    const calls: string[] = [];
    const storage = new Map<string, string>();
    const service = new QualityService().configureRuntime({
      windowRef: { VortexRuntime: { renderer: { snapshot: () => ({ attached: true }) } } } as any,
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => { storage.set(key, value); }
      } as any,
      renderer: { getPixelRatio: () => 1, userData: { vwebBackend: "webgpu" } },
      scene: { fog: null },
      shadows: { snapshot: () => ({ active: false }), markNeedsUpdate: () => calls.push("shadows:update") },
      rendererService: {
        detectRendererBackend: () => "webgpu",
        getShadowQuality: () => "low",
        snapshot: () => ({}),
        diagnoseScene: () => ({ darkSamples: [] })
      },
      toneMappingMode: () => "none",
      fogSettings: () => ({ enabled: false }),
      shadowQuality: () => "low",
      shadowMapSize: () => 256,
      shadowsActive: () => false,
      readStorageFlag: () => false,
      useStudTextures: () => true,
      textureDiagnostics: () => [],
      caches: () => ({ parts: 1 }),
      setShadows: (value) => calls.push(`shadows:${String(value)}`),
      setShadowQuality: (value) => calls.push(`quality:${String(value)}`),
      setToneMapping: (value) => calls.push(`tone:${String(value)}`),
      setRenderFog: (value) => calls.push(`fog:${String(value)}`),
      setFogDistance: (value) => calls.push(`fogDistance:${String(value)}`),
      setRenderDistance: (value, profile) => calls.push(`renderDistance:${String(value)}:${String(profile)}`),
      setStudTexturesEnabled: (value) => calls.push(`studs:${String(value)}`),
      refreshMaterials: () => calls.push("refresh"),
      diagnoseSceneInput: () => ({})
    });

    expect(service.get()).toMatchObject({ rendererBackend: "webgpu", studTextures: true });
    service.performance();
    expect(calls).toEqual(["shadows:false", "quality:low", "tone:none", "fog:false", "renderDistance:700:performance", "studs:false", "refresh"]);
  });
});
