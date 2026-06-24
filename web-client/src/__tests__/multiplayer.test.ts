import { describe, expect, it } from "vitest";
import { MultiplayerService } from "../network/MultiplayerService";

describe("MultiplayerService", () => {
  it("records relay message summaries without retaining full payloads", () => {
    const multiplayer = new MultiplayerService();

    multiplayer.recordMessage({
      type: "states",
      players: [{ id: 10, username: "a" }, { id: 20, username: "b" }]
    });

    expect(multiplayer.messagesSnapshot()).toMatchObject([
      { type: "states", playerCount: 2, ids: [10, 20] }
    ]);
  });

  it("tracks remote receive/accept/reject/hide debug state", () => {
    const multiplayer = new MultiplayerService();
    const remote = {
      username: "remote",
      hasPosition: true,
      seen: 100,
      tPos: { x: 1, y: 2, z: 3 },
      meshes: { grp: { visible: true, position: { x: 4, y: 5, z: 6 } } }
    };

    multiplayer.noteRemoteState(remote, "received", "", { x: 1, y: 2, z: 3, ry: 0, anim: "idle" }, "states");
    multiplayer.noteRemoteState(remote, "accepted", "", { x: 1, y: 2, z: 3, ry: 0, anim: "idle" }, "states");
    multiplayer.noteRemoteState(remote, "rejected", "bad", { x: Number.NaN }, "states");
    multiplayer.noteRemoteState(remote, "hidden", "stale-position", null, "render");

    expect(multiplayer.remoteDebugRows(new Map([[7, remote]]), 250)).toEqual([
      {
        id: 7,
        username: "remote",
        visible: true,
        hasPosition: true,
        ageMs: 150,
        received: 1,
        accepted: 1,
        rejected: 1,
        lastRejectedReason: "bad",
        hiddenReason: "stale-position",
        lastSource: "render",
        lastRaw: null,
        target: { x: 1, y: 2, z: 3 },
        mesh: { x: 4, y: 5, z: 6 }
      }
    ]);
  });

  it("validates and converts remote scene positions", () => {
    const multiplayer = new MultiplayerService();

    expect(multiplayer.readRemoteScenePosition({ x: 10, y: 20, z: 30, ry: 1 }, (y) => y - 2)).toEqual({
      state: { pos: { x: 10, y: 18, z: 30 }, ry: 1 },
      reason: ""
    });
    expect(multiplayer.readRemoteScenePosition({ x: 10, y: -9999, z: 30, ry: 1 }, (y) => y)).toEqual({
      state: null,
      reason: "below-scene-floor"
    });
    expect(multiplayer.readRemoteScenePosition({ x: Number.NaN, y: 20, z: 30, ry: 1 }, (y) => y)).toEqual({
      state: null,
      reason: "non-finite-position"
    });
  });
});
