import { describe, expect, it } from "vitest";
import { WorldBootstrapService } from "../world/WorldBootstrapService";

function makeDocument() {
  return {
    body: {
      children: [] as unknown[],
      appendChild(node: unknown) {
        this.children.push(node);
      }
    },
    createElement(tag: string) {
      return { tag, innerHTML: "", style: {} };
    }
  } as unknown as Document;
}

function makeWindow(href = "https://playvortex.io/games/1?Play=1&VortexGameId=3") {
  return {
    fetch: async () => new Response("[]", { status: 200 }),
    setTimeout: () => 0,
    Chat: { messages: [] as string[], system(message: string) { this.messages.push(message); } }
  } as unknown as Window & {
    GAME_ID?: number;
    map?: { name: string; spawnPoints: Array<[number, number, number]> } | false;
    chooseSpawnPoint?: (map?: { name: string; spawnPoints: Array<[number, number, number]> } | false) => { x: number; y: number; z: number };
    Chat: { messages: string[]; system(message: string): void };
  };
}

function makeLocation(href = "https://playvortex.io/games/1?Play=1&VortexGameId=3") {
  return { href } as Location;
}

describe("WorldBootstrapService", () => {
  it("installs map globals and records the current map on the session", () => {
    const documentRef = makeDocument();
    const windowRef = makeWindow();
    const service = new WorldBootstrapService(documentRef, windowRef, makeLocation());
    let mapName = "";

    service.installGlobals({
      world: {} as never,
      gameSession: { setMapName: (name: string) => { mapName = name; } } as never
    });

    expect(windowRef.GAME_ID).toBe(3);
    expect(windowRef.map && windowRef.map.name).toBe("Official Vortex 3");
    expect(mapName).toBe("Official Vortex 3");
    expect(windowRef.chooseSpawnPoint?.(windowRef.map)).toEqual({ x: 0, y: 10, z: 0 });
  });

  it("checks for the legacy handles needed by current map loading", () => {
    const service = new WorldBootstrapService(makeDocument(), makeWindow(), makeLocation());
    const handles = {
      addStud() {},
      removeStud() {},
      createMesh() {},
      setSpawn() {},
      scene: {},
      bufferGeometryUtils: {}
    };

    expect(service.ready({ world: { getLegacyHandles: () => handles, loadOfficialMap() {} } as never })).toBe(true);
    expect(service.ready({ world: { getLegacyHandles: () => ({ ...handles, addStud: null }), loadOfficialMap() {} } as never })).toBe(false);
  });

  it("falls back to a baseplate when official map loading fails", async () => {
    const windowRef = makeWindow();
    const service = new WorldBootstrapService(makeDocument(), windowRef, makeLocation());
    const spawns: number[][] = [];
    const world = {
      loadOfficialMap: async () => {
        throw new Error("offline");
      },
      loadMapParts: (name: string) => ({
        name,
        partIds: ["fallback"],
        bounds: { centerX: 0, centerY: 0, centerZ: 0, minX: 0, maxX: 0, minY: 0, maxY: 0, minZ: 0, maxZ: 0 }
      }),
      getLegacyHandles: () => ({
        setSpawn: (...args: number[]) => spawns.push(args)
      })
    };

    await service.initialize({ world: world as never }, async () => new Response("[]", { status: 500 }));

    expect(windowRef.map && windowRef.map.name).toBe("Fallback Baseplate");
    expect(spawns).toEqual([[0, 10, 0, 0]]);
    expect(windowRef.Chat.messages).toEqual(["Could not load official map 3; using fallback baseplate."]);
  });
});
