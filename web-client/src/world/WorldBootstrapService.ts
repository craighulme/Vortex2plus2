import type { GameSession } from "../game/GameSession";
import type { WorldService } from "./WorldService";

export type CurrentMapState = {
  name: string;
  officialGameId?: number;
  spawnPoints: Array<[number, number, number]>;
};

type RuntimeWorldBootstrap = {
  world: WorldService;
  gameSession?: Pick<GameSession, "setMapName">;
};

type BootstrapWindow = Window & {
  VortexRuntime?: RuntimeWorldBootstrap & { worldBootstrap?: WorldBootstrapService };
  __vwebMapLoaderBooted?: boolean;
  map?: CurrentMapState | false;
  GAME_ID?: number;
  chooseSpawnPoint?: (map?: CurrentMapState | false) => { x: number; y: number; z: number };
  Chat?: { system?(message: string): void };
};

export class WorldBootstrapService {
  private watermarkMounted = false;

  constructor(
    private readonly documentRef: Document,
    private readonly windowRef: BootstrapWindow,
    private readonly locationRef: Location
  ) {}

  installGlobals(runtime: RuntimeWorldBootstrap): void {
    this.windowRef.chooseSpawnPoint = (map) => this.chooseSpawnPoint(map);
    const gameId = this.officialGameId();
    if (gameId > 0) {
      this.setCurrentMap(runtime, {
        name: `Official Vortex ${gameId}`,
        officialGameId: gameId,
        spawnPoints: [[0, 10, 0]]
      });
      this.defineGameId(gameId);
      console.info(`official game id set to ${gameId}`);
    } else {
      this.setCurrentMap(runtime, null);
    }
    console.info("set window map data");
  }

  boot(runtime: RuntimeWorldBootstrap, fetcher: typeof fetch = this.windowRef.fetch.bind(this.windowRef), attempt = 0): void {
    if (this.windowRef.__vwebMapLoaderBooted) return;
    if (!this.ready(runtime)) {
      if (attempt === 0) console.info("waiting for Vortex engine before map loader");
      if (attempt > 200) {
        console.warn("map loader could not start: Vortex runtime world handles were not ready");
        return;
      }
      this.windowRef.setTimeout(() => this.boot(runtime, fetcher, attempt + 1), 50);
      return;
    }
    this.windowRef.__vwebMapLoaderBooted = true;
    console.info("initializing map loader");
    this.initialize(runtime, fetcher).catch((error) => {
      this.windowRef.__vwebMapLoaderBooted = false;
      console.warn("map loader initialization failed", error);
    });
    this.mountWatermark();
  }

  ready(runtime: RuntimeWorldBootstrap): boolean {
    const world = runtime.world;
    if (!world || typeof world.loadOfficialMap !== "function" || typeof world.getLegacyHandles !== "function") return false;
    const handles = world.getLegacyHandles();
    return typeof handles.addStud === "function" &&
      typeof handles.removeStud === "function" &&
      typeof handles.createMesh === "function" &&
      typeof handles.setSpawn === "function" &&
      Boolean(handles.scene) &&
      Boolean(handles.bufferGeometryUtils);
  }

  async initialize(runtime: RuntimeWorldBootstrap, fetcher: typeof fetch = this.windowRef.fetch.bind(this.windowRef)): Promise<void> {
    const gameId = this.officialGameId();
    if (!this.hasPlayParam() || gameId <= 0) return;
    const world = runtime.world;
    try {
      const loaded = await world.loadOfficialMap(gameId, (input, init) => fetcher(input, init as RequestInit));
      const spawn = loaded.spawn || {
        x: loaded.bounds.centerX,
        y: loaded.bounds.maxY + 8,
        z: loaded.bounds.centerZ,
        ry: 0
      };
      this.setCurrentMap(runtime, {
        name: loaded.name,
        officialGameId: gameId,
        spawnPoints: [[spawn.x, spawn.y, spawn.z]]
      });
      console.info(`loaded official Vortex map ${gameId}`, {
        parts: loaded.partIds.length,
        bounds: loaded.bounds,
        spawn
      });
    } catch (error) {
      console.warn(`Failed to load official Vortex map ${gameId}`, error);
      this.windowRef.Chat?.system?.(`Could not load official map ${gameId}; using fallback baseplate.`);
      const fallback = world.loadMapParts("Fallback Baseplate", [
        { P: [0, 0, 0], S: [320, 3.2, 320], C: "4db84b", Sh: "Block" }
      ], 0, 0, 0, { preserveWorldCoords: true, rotationRadians: true, rotationOrder: "XYZ" });
      const spawn = { x: 0, y: 10, z: 0, ry: 0 };
      const setSpawn = world.getLegacyHandles?.().setSpawn;
      if (typeof setSpawn === "function") setSpawn(spawn.x, spawn.y, spawn.z, spawn.ry);
      this.setCurrentMap(runtime, {
        name: fallback.name,
        officialGameId: gameId,
        spawnPoints: [[spawn.x, spawn.y, spawn.z]]
      });
    }
  }

  chooseSpawnPoint(map: CurrentMapState | false | null | undefined): { x: number; y: number; z: number } {
    if (!map || !Array.isArray(map.spawnPoints) || !map.spawnPoints.length) {
      return { x: 0, y: 10, z: 0 };
    }
    const entry = map.spawnPoints[Math.floor(Math.random() * map.spawnPoints.length)] || [0, 10, 0];
    return { x: entry[0] ?? 0, y: entry[1] ?? 10, z: entry[2] ?? 0 };
  }

  private setCurrentMap(runtime: RuntimeWorldBootstrap, map: CurrentMapState | null): void {
    this.windowRef.map = map || false;
    runtime.gameSession?.setMapName?.(this.windowRef.map ? this.windowRef.map.name : "");
  }

  private mountWatermark(): void {
    if (this.watermarkMounted) return;
    this.watermarkMounted = true;
    const watermark = this.documentRef.createElement("a");
    watermark.innerHTML = "Vortex Web by @inuk";
    Object.assign(watermark.style, {
      position: "fixed",
      bottom: "5px",
      left: "5px",
      color: "white",
      fontSize: "x-small",
      opacity: "0.1"
    });
    this.documentRef.body.appendChild(watermark);
  }

  private officialGameId(): number {
    const url = new URL(this.locationRef.href);
    return parseInt(url.searchParams.get("VortexGameId") || "0", 10);
  }

  private hasPlayParam(): boolean {
    return new URL(this.locationRef.href).searchParams.has("Play");
  }

  private defineGameId(gameId: number): void {
    if (Object.prototype.hasOwnProperty.call(this.windowRef, "GAME_ID")) return;
    Object.defineProperty(this.windowRef, "GAME_ID", {
      value: gameId,
      writable: false,
      configurable: false
    });
  }
}
