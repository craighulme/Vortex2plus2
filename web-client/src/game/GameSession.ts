import type { EventBus } from "../runtime/EventBus";
import type { RuntimeEventMap } from "../runtime/types";
import type { BridgeConfig } from "../platform/PlatformBridge";

export type GameSessionSnapshot = {
  officialGameId: number;
  customGameId: string | null;
  mapName: string;
};

export class GameSession {
  private mapName = "";

  constructor(
    private readonly bridgeConfig: BridgeConfig,
    private readonly events: EventBus<RuntimeEventMap>
  ) {}

  setMapName(name: string): void {
    this.mapName = name;
    this.emit();
  }

  snapshot(): GameSessionSnapshot {
    return {
      officialGameId: this.bridgeConfig.officialGameId,
      customGameId: this.bridgeConfig.customGameId,
      mapName: this.mapName
    };
  }

  private emit(): void {
    this.events.emit("session:changed", { snapshot: this.snapshot() });
  }
}
