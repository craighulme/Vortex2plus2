import { describe, expect, it } from "vitest";
import { MultiplayerMessageRouter, type MultiplayerMessageRouterContext } from "../network/relay/MultiplayerMessageRouter";

describe("MultiplayerMessageRouter", () => {
  it("handles init by setting local state, spawning initial players, and starting broadcast", () => {
    const router = new MultiplayerMessageRouter();
    const events: string[] = [];
    const ctx = context(events);

    router.handle({
      type: "init",
      id: 1,
      username: "self",
      shirt_id: 8,
      players: [{ id: 2, username: "remote" }]
    }, ctx);

    expect(ctx.selfId()).toBe(1);
    expect(events).toEqual([
      "setLaunchInfo:self",
      "leaderboardSelf:1",
      "leaderboardAdd:self",
      "record:init:2",
      "prefetch:array",
      "addRemote:2:remote",
      "applyLocalAvatar:init",
      "fetchFriendData",
      "startBroadcast"
    ]);
  });

  it("handles states by adding missing remotes and decoding positions", () => {
    const router = new MultiplayerMessageRouter();
    const events: string[] = [];
    const ctx = context(events);
    ctx.setSelfId(1);

    router.handle({ type: "states", players: [{ id: 2, username: "remote" }, { id: 1, username: "self" }] }, ctx);

    expect(events).toContain("record:states:2");
    expect(events).toContain("addRemote:2:remote");
    expect(events).toContain("decode:2:states");
  });

  it("repairs placeholder names from later state identity", () => {
    const router = new MultiplayerMessageRouter();
    const events: string[] = [];
    const ctx = context(events);
    ctx.setSelfId(1);
    ctx.addRemote(2, "#2", false, false, {});

    router.handle({ type: "states", players: [{ id: 2, username: "Kid" }] }, ctx);

    expect(events).toContain("known:2:Kid");
    expect(events).toContain("decode:2:states");
  });

  it("prefetches avatar assets from state identity updates", () => {
    const router = new MultiplayerMessageRouter();
    const events: string[] = [];
    const ctx = context(events);
    ctx.setSelfId(1);

    router.handle({ type: "states", players: [{ id: 2, username: "Kid", shirt_id: 8, face_id: 56 }] }, ctx);

    expect(events).toContain("prefetch:array");
    expect(events).toContain("addRemote:2:Kid");
  });

  it("handles chat and friend events", () => {
    const router = new MultiplayerMessageRouter();
    const events: string[] = [];
    const ctx = context(events);
    ctx.setSelfId(1);

    router.handle({ type: "chat", id: 2, username: "remote", msg: "hi" }, ctx);
    router.handle({ type: "friend_request", from_id: 2, from_username: "remote" }, ctx);

    expect(events).toContain("known:2:remote");
    expect(events).toContain("chat:remote:hi:false");
    expect(events).toContain("bubble:2:hi");
    expect(events).toContain("friendRequest:2");
    expect(events).toContain("runtimeFriend:2:request_received");
    expect(events).toContain("leaderboardFriend:2:request_received");
  });
});

function context(events: string[]): MultiplayerMessageRouterContext {
  let selfId: number | null = null;
  let launchInfo: Record<string, unknown> | null = null;
  const remotes = new Map<unknown, unknown>();
  return {
    selfId: () => selfId,
    setSelfId: (id) => { selfId = id; },
    launchInfo: () => launchInfo,
    setLaunchInfoFromInit: (_message, username) => {
      launchInfo = { username };
      events.push(`setLaunchInfo:${username}`);
    },
    fallbackGameId: () => 1,
    displayName: (_id, username) => String(username || ""),
    applyKnownPlayerName: (id, username) => events.push(`known:${id}:${username}`),
    recordPlayers: (source, players) => events.push(`record:${source}:${players.length}`),
    recordProbe: (event) => events.push(`probe:${event.type}`),
    recordLeave: (id) => events.push(`leave:${id}`),
    hasRemote: (id) => remotes.has(id),
    getRemote: (id) => remotes.get(id),
    addRemote: (id, username) => {
      remotes.set(id, { id, username });
      events.push(`addRemote:${id}:${username}`);
    },
    removeRemote: (id) => {
      remotes.delete(id);
      events.push(`removeRemote:${id}`);
    },
    decodeRemoteState: (player, _remote, source) => events.push(`decode:${(player as { id?: unknown }).id}:${source}`),
    prefetchAvatarImages: (value) => events.push(`prefetch:${Array.isArray(value) ? "array" : "one"}`),
    applyLocalAvatar: (value) => events.push(`applyLocalAvatar:${(value as { type?: unknown }).type}`),
    applyAvatarToRemote: () => false,
    updatePendingShirt: (id, shirt) => events.push(`pendingShirt:${id}:${shirt}`),
    setLeaderboardSelf: (id) => events.push(`leaderboardSelf:${id}`),
    addLeaderboardPlayer: (player) => events.push(`leaderboardAdd:${player.username}`),
    setLeaderboardFriendStatus: (id, status) => events.push(`leaderboardFriend:${id}:${status}`),
    setRuntimeFriendStatus: (id, status) => {
      events.push(`runtimeFriend:${id}:${status}`);
      return status;
    },
    fetchFriendData: () => events.push("fetchFriendData"),
    startBroadcast: () => events.push("startBroadcast"),
    kicked: () => events.push("kicked"),
    openScreen: (screenId) => events.push(`screen:${screenId}`),
    chat: {
      system: (message) => events.push(`system:${message}`),
      systemRed: (message) => events.push(`systemRed:${message}`),
      systemPlayer: (username, message) => events.push(`systemPlayer:${username}:${message}`),
      clearPlayerMsg: (username) => events.push(`clear:${username}`),
      message: (username, message, self) => events.push(`chat:${username}:${message}:${self}`),
      warn: (message) => events.push(`warn:${message}`)
    },
    bubble: (id, message) => events.push(`bubble:${id}:${message}`),
    notifications: {
      friendRequest: (id) => events.push(`friendRequest:${id}`),
      friendRequestCancelled: (id) => events.push(`friendCancel:${id}`),
      friendAccepted: (username) => events.push(`friendAccepted:${username}`),
      followed: (username) => events.push(`followed:${username}`),
      unfollowed: (username) => events.push(`unfollowed:${username}`)
    }
  };
}
