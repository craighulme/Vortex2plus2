import { describe, expect, it } from "vitest";
import { GameSession } from "../game/GameSession";

describe("GameSession", () => {
  it("tracks native game session metadata", () => {
    const events = { emit() {} };
    const session = new GameSession({ officialGameId: 3, customGameId: null } as any, events as any);

    session.setMapName("Crossroads");

    expect(session.snapshot()).toMatchObject({
      officialGameId: 3,
      mapName: "Crossroads"
    });
  });
});
