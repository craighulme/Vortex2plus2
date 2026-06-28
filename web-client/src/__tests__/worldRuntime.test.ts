import { describe, expect, it } from "vitest";
import { WorldRuntimeService } from "../world/WorldRuntimeService";

describe("WorldRuntimeService", () => {
  it("wires textures, world services, and bound part handles", () => {
    const textureService = {
      config: null as any,
      configured: false,
      configure(config: any) {
        this.config = config;
        this.configured = true;
        return this;
      },
      applyStudTexturesToMaterial: (_material: unknown) => {},
      useStudTextures: () => true,
      diagnostics: () => [{ key: "stud" }]
    };
    const geometryService = {
      configuredWith: null as unknown,
      configure(THREE: unknown) {
        this.configuredWith = THREE;
        return this;
      }
    };
    const materialService = {
      config: null as any,
      refreshes: 0,
      configure(config: any) {
        this.config = config;
        return this;
      },
      refreshStudTextures() {
        this.refreshes += 1;
      }
    };
    const colliderService = {
      configuredWith: null as unknown,
      colliders: [{ id: "c1" }],
      configure(THREE: unknown) {
        this.configuredWith = THREE;
        return this;
      },
      getNearbyColliders: () => new Set([{ id: "near" }]),
      snapshot: () => ({ colliders: 1, chunks: 1, chunkSize: 4 })
    };
    const partService = {
      objects: [{ id: "mesh" }],
      config: null as any,
      configure(config: any) {
        this.config = config;
        return this;
      },
      addStud(...args: unknown[]) {
        return ["mesh", args.length];
      },
      removeStud(id: number) {
        this.removed = id;
      },
      removed: -1
    };
    const sceneSettings = { marks: 0, markMaterialsForShaderUpdate() { this.marks += 1; } };
    const shadows = { marks: 0, active: () => true, markNeedsUpdate() { this.marks += 1; } };

    const handles = new WorldRuntimeService().configure({
      THREE: { TextureLoader: function TextureLoader() {} },
      scene: {},
      renderer: { capabilities: { getMaxAnisotropy: () => 16 } },
      textures: textureService as any,
      geometry: geometryService as any,
      materials: materialService as any,
      colliders: colliderService as any,
      parts: partService as any,
      sceneSettings: sceneSettings as any,
      shadows: shadows as any,
      studsPerTile: 4,
      runtimeAsset: (path) => path === "textures.stud" ? "stud.png" : "normal.png"
    });

    expect(textureService.config.maxTextureAnisotropy).toBe(4);
    expect(textureService.config.importedAssets).toEqual({ stud: "stud.png", studNormal: "normal.png" });
    expect(materialService.config.studsPerTile).toBe(4);
    expect(partService.config.shadowsActive()).toBe(true);
    expect(handles.objects).toEqual(partService.objects);
    expect(handles.colliders).toEqual(colliderService.colliders);
    expect(handles.addStud(1, 2, 3, 4, 5, 6, 7)).toEqual(["mesh", 7]);
    handles.removeStud(42);
    expect(partService.removed).toBe(42);

    textureService.config.onTextureChanged();
    expect(materialService.refreshes).toBe(1);
    expect(sceneSettings.marks).toBe(1);
    expect(shadows.marks).toBe(1);
  });
});
