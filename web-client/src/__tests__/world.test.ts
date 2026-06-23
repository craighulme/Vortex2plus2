import { describe, expect, it } from "vitest";
import { WorldService } from "../world/WorldService";

describe("WorldService", () => {
  it("normalizes map parts and mirrors them through the legacy add/remove backend", () => {
    const world = new WorldService();
    const added: unknown[] = [];
    const removed: unknown[] = [];
    world.attachLegacy({
      addPart: (...args: unknown[]) => {
        added.push(args);
        return { id: `legacy-${added.length}` };
      },
      removePart: (id: unknown) => removed.push(id)
    });

    const loaded = world.loadMapParts("test", [
      { P: [10, 2, 20], S: [4, 2, 6], C: "ff0000" },
      { Position: [14, 4, 20], Size: [2, 2, 2], Color: [0, 1, 0], CantCollide: true }
    ], 0, 1.6, 0, { preserveWorldCoords: true });

    expect(loaded.partIds).toHaveLength(2);
    expect(added).toHaveLength(2);
    expect(loaded.bounds.centerX).toBe(11.5);
    expect(world.loadedMaps()).toHaveLength(1);

    expect(world.unloadMap("test")).toBe(true);
    expect(removed).toEqual(["legacy-1", "legacy-2"]);
  });
});
