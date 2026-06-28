import { describe, expect, it } from "vitest";
import { RemoteSessionService } from "../avatar/RemoteSessionService";

const AVATAR = {
  shirt_id: 0,
  pant_id: 0,
  body_type: "male" as const,
  body_colors: ["#fff", "#fff", "#fff", "#fff", "#fff", "#fff"],
  face_id: 0
};

describe("RemoteSessionService", () => {
  it("adds, updates, and removes remotes through one owner", () => {
    const service = new RemoteSessionService();
    const events: string[] = [];
    const remote = service.addRemote(options(events, {
      id: 2,
      username: "remote",
      avatarData: { x: 1, y: 2, z: 3, ry: 0.5 }
    }));

    expect(service.has(2)).toBe(true);
    expect(remote.hasPosition).toBe(true);
    expect(events).toContain("leaderboardAdd:remote");
    expect(events).toContain("friend:2:none");
    expect(events).not.toContain("hydrate:2");

    service.addRemote(options(events, {
      id: 2,
      username: "renamed",
      isStaff: true,
      avatarData: { x: 2, y: 3, z: 4, ry: 1 }
    }));

    expect(service.get(2)?.username).toBe("renamed");
    expect(events).toContain("label:renamed");
    expect(events).toContain("decode:2:addRemote");

    expect(service.removeRemote(2, {
      clearBubble: (id) => events.push(`clear:${id}`),
      disposeMeshes: () => events.push("dispose"),
      removeLeaderboard: (id) => events.push(`leaderboardRemove:${id}`)
    })).toBe(true);
    expect(service.has(2)).toBe(false);
    expect(events).toContain("clear:2");
    expect(events).toContain("dispose");
    expect(events).toContain("leaderboardRemove:2");
  });

  it("queues pending avatars when meshes cannot be created yet", () => {
    const service = new RemoteSessionService();
    service.addRemote(options([], {
      id: 3,
      username: "pending",
      canCreateMeshes: false
    }));

    expect(service.snapshot()).toMatchObject({ remotes: 1, pendingAvatars: 1 });
  });

  it("applies recovered profile names to remote records, nametags, pending avatars, and leaderboard", () => {
    const service = new RemoteSessionService();
    const events: string[] = [];
    const remote = service.addRemote(options(events, {
      id: 21264,
      username: "#21264",
      canCreateMeshes: false
    }));
    expect(remote.username).toBe("#21264");

    service.applyKnownPlayerName(21264, "RecoveredName", {
      remember: (_id, username) => String(username || ""),
      setNameLabel: (_remote, username) => events.push(`label:${username}`),
      addLeaderboard: (player) => events.push(`leaderboardAdd:${player.username}`)
    });

    expect(service.get(21264)?.username).toBe("RecoveredName");
    expect(service.pendingAvatars.get(21264)?.username).toBe("RecoveredName");
    expect(events).toContain("leaderboardAdd:RecoveredName");
    expect(events).toContain("label:RecoveredName");

    const visibleRemote = service.addRemote(options(events, {
      id: 21265,
      username: "#21265"
    }));
    expect(visibleRemote.meshes).toBeTruthy();

    service.applyKnownPlayerName(21265, "VisibleName", {
      remember: (_id, username) => String(username || ""),
      setNameLabel: (_remote, username) => events.push(`label:${username}`),
      addLeaderboard: (player) => events.push(`leaderboardAdd:${player.username}`)
    });

    expect(service.get(21265)?.username).toBe("VisibleName");
    expect(events).toContain("label:VisibleName");
    expect(events).toContain("leaderboardAdd:VisibleName");
  });

  it("removes remote bookkeeping even when mesh disposal fails", () => {
    const service = new RemoteSessionService();
    const events: string[] = [];
    service.addRemote(options(events, {
      id: 6,
      username: "bad-dispose"
    }));

    expect(service.removeRemote(6, {
      clearBubble: (id) => events.push(`clear:${id}`),
      disposeMeshes: () => {
        events.push("dispose");
        throw new Error("bad mesh graph");
      },
      removeLeaderboard: (id) => events.push(`leaderboardRemove:${id}`)
    })).toBe(true);

    expect(service.has(6)).toBe(false);
    expect(events).toContain("leaderboardRemove:6");
  });

  it("builds command player lists from local and remote state", () => {
    const service = new RemoteSessionService();
    service.addRemote(options([], {
      id: 4,
      username: "remote",
      avatarData: { x: 1, y: 2, z: 3, ry: 0 }
    }));

    expect(service.commandPlayerList({
      localId: 1,
      localUsername: "self",
      localPosition: { x: 0, y: 0, z: 0 }
    })).toMatchObject([
      { id: 1, username: "self", self: true },
      { id: 4, username: "remote", self: false }
    ]);
  });

  it("applies remote avatar patches and accepted/rejected position states", () => {
    const service = new RemoteSessionService();
    const events: string[] = [];
    const remote = service.addRemote(options(events, {
      id: 5,
      username: "remote",
      avatarData: { x: 1, y: 2, z: 3, ry: 0 }
    }));

    const applied: unknown[] = [];
    expect(service.applyRemoteState({
      id: 5,
      x: 10,
      y: 20,
      z: 30,
      ry: 1,
      anim: "walk",
      shirt_id: 12
    }, remote, {
      source: "states",
      normalizeAvatar: (data) => ({ ...AVATAR, shirt_id: Number(data.shirt_id || 0) }),
      avatarSignature: (avatar) => JSON.stringify({ shirt_id: Number((avatar as { shirt_id?: unknown })?.shirt_id || 0) }),
      avatarPatch: (data) => ({ shirt_id: Number((data as { shirt_id?: unknown }).shirt_id || 0) }),
      readScenePosition: (data) => ({ state: { pos: vector(Number(data.x), Number(data.y), Number(data.z)), ry: Number(data.ry) }, reason: "" }),
      noteState: (_remote, status, reason, _data, source) => events.push(`applyState:${status}:${reason}:${source}`),
      applyAvatar: (_remote, avatar) => applied.push(avatar),
      now: 1234
    })).toBe(true);

    expect(remote.tPos).toMatchObject({ x: 10, y: 20, z: 30 });
    expect(remote).toMatchObject({ tRy: 1, anim: "walk", seen: 1234, hasPosition: true });
    expect(applied).toMatchObject([{ shirt_id: 12 }]);
    expect(events).toContain("applyState:accepted::states");

    expect(service.applyRemoteState({
      x: Number.NaN,
      y: 20,
      z: 30,
      ry: 1
    }, remote, {
      normalizeAvatar: (data) => ({ ...AVATAR, shirt_id: Number(data.shirt_id || 0) }),
      avatarSignature: (avatar) => JSON.stringify(avatar),
      avatarPatch: () => null,
      readScenePosition: () => ({ state: null, reason: "should-not-run" }),
      noteState: (_remote, status, reason, _data, source) => events.push(`applyState:${status}:${reason}:${source}`),
      applyAvatar: () => undefined
    })).toBe(false);
    expect(events).toContain("applyState:rejected:non-finite-position:states");
  });
});

function options(events: string[], patch: Record<string, unknown> = {}) {
  const id = patch.id ?? 2;
  const username = patch.username ?? "remote";
  return {
    id,
    username,
    isStaff: patch.isStaff,
    isBooster: patch.isBooster,
    avatarData: (patch.avatarData as Record<string, unknown>) || {},
    displayName: (_id: unknown, name: unknown) => String(name || ""),
    normalizeAvatar: (data: Record<string, unknown>) => ({ ...AVATAR, shirt_id: Number(data.shirt_id || 0) }),
    readInitialState: (data: Record<string, unknown>) => Number.isFinite(Number(data.x))
      ? { pos: vector(Number(data.x), Number(data.y), Number(data.z)), ry: Number(data.ry || 0) }
      : null,
    createPosition: () => vector(0, 0, 0),
    canCreateMeshes: () => patch.canCreateMeshes !== false,
    makeRemote: () => ({ grp: { visible: false, position: vector(0, 0, 0), rotation: { y: 0 } } }),
    setNameLabel: (_remote: unknown, name: string) => events.push(`label:${name}`),
    decodeRemoteState: (data: Record<string, unknown>, _remote: unknown, source: string) => events.push(`decode:${idOf(data, id)}:${source}`),
    noteState: (_remote: unknown, status: string, reason: string, _data?: unknown, source?: string) => events.push(`state:${status}:${reason}:${source}`),
    addLeaderboard: (player: { username: string }) => events.push(`leaderboardAdd:${player.username}`),
    setFriendStatus: (remoteId: unknown, status: string) => events.push(`friend:${remoteId}:${status}`),
    statusFor: () => "none",
    onCreateError: (error: unknown) => events.push(`error:${String(error)}`)
  };
}

function vector(x: number, y: number, z: number) {
  return {
    x,
    y,
    z,
    clone() { return vector(x, y, z); },
    copy(value: { x?: number; y?: number; z?: number }) {
      this.x = Number(value.x || 0);
      this.y = Number(value.y || 0);
      this.z = Number(value.z || 0);
    }
  };
}

function idOf(data: Record<string, unknown>, fallback: unknown): unknown {
  return data.id ?? fallback;
}
