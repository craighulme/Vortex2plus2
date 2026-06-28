import { describe, expect, it } from "vitest";
import { WorldService } from "../world/WorldService";

describe("WorldService", () => {
  it("uses the legacy stud backend when it is available", () => {
    const world = new WorldService();
    const added: unknown[][] = [];
    const removed: unknown[] = [];
    world.attachLegacy({
      addStud: (...args: unknown[]) => {
        added.push(args);
        return [null, `stud-${added.length}`];
      },
      removeStud: (id: unknown) => removed.push(id)
    });

    world.loadMapParts("studs", [
      { P: [10, 2, 20], S: [4, 2, 6], R: [0, 90, 0], C: "ff0000", T: "Truss", Shape: "Block" }
    ], 0, 0, 0, { preserveWorldCoords: true, rotationRadians: false, rotationOrder: "XYZ" });

    expect(added).toHaveLength(1);
    expect(added[0]?.slice(0, 7)).toEqual([4, 2, 6, 0xff0000, 10, 1, 20]);
    expect(added[0]?.[10]).toBe("Block");
    expect(added[0]?.[14]).toBe("XYZ");
    expect(added[0]?.[15]).toBe("Truss");

    expect(world.unloadMap("studs")).toBe(true);
    expect(removed).toEqual(["stud-1"]);
  });

  it("loads official maps through the runtime service and sets spawn from map bounds", async () => {
    const world = new WorldService();
    const requests: unknown[][] = [];
    const spawns: unknown[][] = [];
    const added: unknown[][] = [];
    world.attachLegacy({
      addStud: (...args: unknown[]) => {
        added.push(args);
        return [null, `stud-${added.length}`];
      },
      setSpawn: (...args: unknown[]) => spawns.push(args)
    });

    const loaded = await world.loadOfficialMap(3, async (input, init) => {
      requests.push([input, init]);
      return {
        ok: true,
        status: 200,
        json: async () => [
          { P: [10, 2, 20], S: [4, 2, 6], C: "ff0000" },
          { P: [14, 4, 20], S: [2, 2, 2], C: "00ff00" }
        ]
      };
    });

    expect(requests).toEqual([[
      "/api/maps/3",
      { credentials: "include", cache: "no-store" }
    ]]);
    expect(loaded.name).toBe("Official Vortex 3");
    expect(loaded.partIds).toHaveLength(2);
    expect(added).toHaveLength(2);
    expect(loaded.spawn).toEqual({ x: 11.5, y: 13, z: 20, ry: 0 });
    expect(spawns).toEqual([[11.5, 13, 20, 0]]);
  });
});
