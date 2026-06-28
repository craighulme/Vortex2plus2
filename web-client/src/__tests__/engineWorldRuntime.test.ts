import { describe, expect, it, vi } from "vitest";
import { RuntimeAssetResolverService } from "../assets/RuntimeAssetResolverService";
import { EngineWorldRuntimeService } from "../world/EngineWorldRuntimeService";

describe("EngineWorldRuntimeService", () => {
  it("wires assets, world runtime, debug visuals, and picking", () => {
    const debugToggle = vi.fn();
    const debugUpdate = vi.fn();
    const pick = vi.fn(() => "hit");
    const worldRuntimeHandles = {
      objects: ["part"],
      colliderService: {
        snapshot: () => ({ colliders: 1, chunks: 1, chunkSize: 4 }),
        worldToChunk: (value: number) => Math.floor(value / 4)
      },
      getNearbyColliders: () => new Set(["collider"]),
      useStudTextures: () => true,
      refreshStudMaterialTextures: vi.fn()
    };

    const service = new EngineWorldRuntimeService().configure({
      THREE: {},
      scene: {},
      renderer: {},
      windowRef: { innerWidth: 100, innerHeight: 80 } as Window,
      assets: {
        resolve: (path: string) => path === "meshes.malePlayerGlb" ? "/male.glb" : null
      },
      assetResolver: new RuntimeAssetResolverService(),
      fallbackAssetRaw: JSON.stringify({ legacy: "/legacy.png" }),
      worldRuntime: { configure: vi.fn(() => worldRuntimeHandles) },
      textures: {},
      geometry: {},
      materials: {},
      colliders: {},
      parts: {},
      sceneSettings: {},
      shadows: {},
      debugVisuals: { configure: vi.fn(() => ({ toggle: debugToggle, update: debugUpdate })) },
      worldPicking: { configure: vi.fn(() => ({ pick })) },
      cursor: { position: () => ({ x: 10, y: 20 }) },
      camera: "camera",
      studsPerTile: 4
    });

    expect(service.runtimeAsset("meshes.malePlayerGlb", "legacy")).toBe("/male.glb");
    expect(service.runtimeAsset("missing", "legacy")).toBe("/legacy.png");
    expect([...service.getNearbyColliders(0, 0, 0)]).toEqual(["collider"]);
    expect(service.getClicked3DPoint()).toBe("hit");
    expect(pick).toHaveBeenCalledWith("camera", ["part"], 10, 20, 100, 80);

    service.toggleDebug({ halfWidth: 1, halfDepth: 0.5, height: 5, footOffset: 2 });
    service.updateDebug("character", { halfWidth: 1, halfDepth: 0.5, height: 5, footOffset: 2 });

    expect(debugToggle).toHaveBeenCalledWith({ charHalfW: 1, charHalfD: 0.5, charHeight: 5 });
    expect(debugUpdate).toHaveBeenCalledWith("character", {
      charHalfW: 1,
      charHalfD: 0.5,
      charHeight: 5,
      charFootOffset: 2
    });
  });
});
