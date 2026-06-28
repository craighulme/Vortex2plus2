import { describe, expect, it } from "vitest";
import { WorldRenderChunkService } from "../world/WorldRenderChunkService";

describe("WorldRenderChunkService", () => {
  it("hides distant render chunks and reports visibility", () => {
    const service = new WorldRenderChunkService();
    const near = { visible: true, userData: {} };
    const far = { visible: true, userData: {} };
    service.setCullDistance(512);
    service.register(near, "map", "0,0", { center: { x: 0, y: 0, z: 0 }, radius: 4 });
    service.register(far, "map", "8,0", { center: { x: 2000, y: 0, z: 0 }, radius: 4 });

    const snapshot = service.update({ x: 0, y: 0, z: 0 });

    expect(near.visible).toBe(true);
    expect(far.visible).toBe(false);
    expect(snapshot).toMatchObject({ chunks: 2, objects: 2, visibleChunks: 1, hiddenChunks: 1 });
  });

  it("restores hidden chunks when disabled or unregistered", () => {
    const service = new WorldRenderChunkService();
    const object = { visible: true, userData: {} };
    service.setCullDistance(512);
    service.register(object, "map", "8,0", { center: { x: 2000, y: 0, z: 0 }, radius: 4 });
    service.update({ x: 0, y: 0, z: 0 });
    expect(object.visible).toBe(false);

    service.setEnabled(false);
    expect(object.visible).toBe(true);
    service.unregister(object);
    expect(service.snapshot()).toMatchObject({ chunks: 0, objects: 0 });
  });

  it("keeps chunks visible when bounds are unavailable", () => {
    const service = new WorldRenderChunkService();
    const object = { visible: true, userData: {} };
    service.setCullDistance(512);
    service.register(object, "map", "unknown", null);

    service.update({ x: 0, y: 0, z: 0 });

    expect(object.visible).toBe(true);
    expect(service.snapshot()).toMatchObject({ visibleChunks: 1, hiddenChunks: 0 });
  });

  it("reports chunk debug bounds", () => {
    const service = new WorldRenderChunkService();
    const object = { visible: true, userData: {} };
    service.register(object, "map", "0,0", {
      center: { x: 5, y: 2, z: 7 },
      radius: 4,
      min: { x: 1, y: 0, z: 3 },
      max: { x: 9, y: 4, z: 11 }
    });

    expect(service.debugRows()).toEqual([
      expect.objectContaining({
        mapName: "map",
        chunkKey: "0,0",
        objects: 1,
        visible: true,
        min: { x: 1, y: 0, z: 3 },
        max: { x: 9, y: 4, z: 11 }
      })
    ]);
  });

  it("hides chunks outside the camera cone after the protected near radius", () => {
    const service = new WorldRenderChunkService();
    const behind = { visible: true, userData: {} };
    const nearbyBehind = { visible: true, userData: {} };
    service.setCullDistance(3000);
    service.register(behind, "map", "0,20", { center: { x: 0, y: 0, z: 1800 }, radius: 16 });
    service.register(nearbyBehind, "map", "0,2", { center: { x: 0, y: 0, z: 128 }, radius: 16 });

    service.update({
      x: 0,
      y: 0,
      z: 0,
      forward: { x: 0, y: 0, z: -1 },
      verticalFovDegrees: 60,
      aspect: 1
    });

    expect(behind.visible).toBe(false);
    expect(nearbyBehind.visible).toBe(true);
    expect(service.snapshot()).toMatchObject({ visibleChunks: 1, hiddenChunks: 1, viewCullingEnabled: true });
  });
});
