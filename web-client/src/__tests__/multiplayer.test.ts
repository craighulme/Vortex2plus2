import { describe, expect, it } from "vitest";
import type { BrokeredSocketWindow } from "../network/relay/BrokeredRelaySocket";
import { MultiplayerConnectionService } from "../network/relay/MultiplayerConnectionService";
import { MultiplayerService } from "../network/MultiplayerService";
import { MultiplayerSessionService, type SocketLike } from "../network/relay/MultiplayerSessionService";
import { PlatformBridge, type BridgeConfig, type LaunchIdentity } from "../platform/PlatformBridge";

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

  it("queues relay messages until runtime exports are ready", () => {
    const multiplayer = new MultiplayerService();
    const handled: unknown[] = [];
    let ready = false;

    expect(multiplayer.queueUntilRuntimeExportsReady({ type: "init" }, ready)).toBe(true);
    expect(multiplayer.queueUntilRuntimeExportsReady({ type: "kicked" }, ready)).toBe(false);
    expect(multiplayer.pendingRuntimeExportMessageCount()).toBe(1);

    multiplayer.flushQueuedRuntimeExportMessages(() => ready, (message) => handled.push(message));
    expect(handled).toEqual([]);

    ready = true;
    multiplayer.flushQueuedRuntimeExportMessages(() => ready, (message) => handled.push(message));
    expect(handled).toEqual([{ type: "init" }]);
    expect(multiplayer.pendingRuntimeExportMessageCount()).toBe(0);
    expect(multiplayer.queueUntilRuntimeExportsReady({ type: "states" }, ready)).toBe(false);
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

  it("throttles bad remote state logs per player", () => {
    const multiplayer = new MultiplayerService();

    expect(multiplayer.shouldLogBadRemoteState(10, 1000)).toBe(false);
    expect(multiplayer.shouldLogBadRemoteState(10, 3500)).toBe(true);
    expect(multiplayer.shouldLogBadRemoteState(10, 4000)).toBe(false);
    expect(multiplayer.shouldLogBadRemoteState(10, 6600)).toBe(true);
    expect(multiplayer.shouldLogBadRemoteState(20, 4000)).toBe(true);
  });

  it("extracts avatar patches from remote state packets", () => {
    const multiplayer = new MultiplayerService();

    expect(multiplayer.remoteAvatarPatch({ x: 1, y: 2 })).toBeNull();
    expect(multiplayer.remoteAvatarPatch({
      shirt_id: "8",
      pant_id: 2,
      body_type: "female",
      body_colors: ["#1", "#2", "#3", "#4", "#5", "#6"],
      face_id: "56"
    })).toEqual({
      shirt_id: 8,
      pant_id: 2,
      body_type: "female",
      body_colors: ["#1", "#2", "#3", "#4", "#5", "#6"],
      face_id: 56
    });
  });

  it("keeps stable player display names when relay packets use placeholders", () => {
    const multiplayer = new MultiplayerService();

    expect(multiplayer.playerDisplayName(18154, "monsterenergy")).toBe("monsterenergy");
    expect(multiplayer.playerDisplayName(18154, "#18154")).toBe("monsterenergy");
    expect(multiplayer.playerDisplayName(18154, "BrowserPlayer")).toBe("monsterenergy");
    expect(multiplayer.playerDisplayName(123, "")).toBe("#123");
    expect(multiplayer.knownNamesSnapshot()).toEqual({ 18154: "monsterenergy" });
  });

  it("creates brokered relay sockets through the runtime service", () => {
    const multiplayer = new MultiplayerService();
    const posts: unknown[] = [];
    const listeners: Array<(event: MessageEvent) => void> = [];
    const windowRef: BrokeredSocketWindow = {
      location: { origin: "https://playvortex.io" },
      crypto: {
        getRandomValues<T extends ArrayBufferView>(values: T): T {
          new Uint8Array(values.buffer, values.byteOffset, values.byteLength).fill(1);
          return values;
        }
      },
      addEventListener(_type: "message", handler: (event: MessageEvent) => void) {
        listeners.push(handler);
      },
      removeEventListener() {
        listeners.length = 0;
      },
      postMessage(message: unknown) {
        posts.push(message);
      },
      setTimeout(handler: () => void) {
        handler();
        return 1;
      }
    };

    const socket = multiplayer.createBrokeredSocket("wss://relay.example/ws", windowRef);
    const connect = posts[0] as { socketId: string };
    expect(connect).toMatchObject({
      vwebBroker: true,
      direction: "page",
      op: "connect",
      url: "wss://relay.example/ws"
    });
    expect(multiplayer.isSocketConnecting(socket)).toBe(true);

    listeners[0]?.({ data: { vwebBroker: true, direction: "extension", socketId: connect.socketId, op: "open" } } as MessageEvent);
    expect(multiplayer.isSocketOpen(socket)).toBe(true);

    socket.send(JSON.stringify({ type: "hello" }));
    expect(posts[1]).toMatchObject({
      vwebBroker: true,
      direction: "page",
      socketId: connect.socketId,
      op: "send",
      data: JSON.stringify({ type: "hello" })
    });
  });

  it("plans relay connection mode and hub URL", () => {
    const multiplayer = new MultiplayerService();

    expect(multiplayer.planBridgeConnection({
      hubUrl: "ws://127.0.0.1:5179/ws",
      brokered: false,
      devLocalRelay: false
    })).toMatchObject({
      blockedLocalRelay: true,
      localRelay: false,
      hostedRelay: false,
      brokeredRelay: false
    });

    expect(multiplayer.planBridgeConnection({
      hubUrl: "wss://relay.example/ws",
      brokered: true,
      devLocalRelay: false
    })).toMatchObject({
      blockedLocalRelay: false,
      localRelay: false,
      hostedRelay: true,
      brokeredRelay: true
    });

    expect(multiplayer.buildHubUrl(
      { hubUrl: "wss://relay.example", officialGameId: 3 },
      { gameId: 7 },
      false
    )).toBe("wss://relay.example/ws?game=7");
  });

  it("builds hosted and local relay hello payloads", () => {
    const multiplayer = new MultiplayerService();
    const launchInfo = {
      id: 18154,
      username: "monsterenergy",
      gameId: 1,
      shirtId: 8,
      pantId: 0,
      bodyType: "male",
      bodyColors: ["#fff"],
      faceId: 56,
      clientToken: "client",
      requestedClientToken: "",
      wsEndpoint: null,
      raw: {},
      licenseLease: { sub: "lease" }
    };

    expect(multiplayer.createRelayHello({
      launchInfo,
      config: { officialGameId: 3, launchToken: "token", identity: null },
      localRelay: true,
      brokeredRelay: false
    })).toMatchObject({
      type: "hello",
      id: 18154,
      username: "monsterenergy",
      gameId: 3,
      shirt_id: 8,
      face_id: 56,
      launchToken: "token",
      clientToken: "client"
    });

    expect(multiplayer.createRelayHello({
      launchInfo,
      config: { officialGameId: 3, launchToken: "token", identity: null },
      localRelay: false,
      brokeredRelay: true,
      avatarOverride: {
        shirt_id: 99,
        pant_id: 4,
        body_type: "female",
        body_colors: ["#000"],
        face_id: 10
      }
    })).toMatchObject({
      gameId: 1,
      shirt_id: 99,
      pant_id: 4,
      body_type: "female",
      face_id: 10
    });
  });

  it("owns local state broadcast pacing", () => {
    const multiplayer = new MultiplayerService();
    const idle = { x: 1, y: 2, z: 3, ry: 0, anim: "idle" };

    expect(multiplayer.shouldBroadcastLocalState(idle, 0)).toBe(false);
    expect(multiplayer.shouldBroadcastLocalState(idle, 50)).toBe(true);
    expect(multiplayer.shouldBroadcastLocalState(idle, 100)).toBe(false);
    expect(multiplayer.shouldBroadcastLocalState(idle, 300)).toBe(true);
    expect(multiplayer.shouldBroadcastLocalState({ ...idle, x: 2 }, 325)).toBe(false);
    expect(multiplayer.shouldBroadcastLocalState({ ...idle, x: 2 }, 350)).toBe(true);

    multiplayer.resetLocalBroadcast();
    expect(multiplayer.shouldBroadcastLocalState(idle, 400)).toBe(true);
  });

  it("builds local packet broadcast state from character input", () => {
    const multiplayer = new MultiplayerService();

    expect(multiplayer.buildLocalBroadcastState({
      x: 1,
      y: 5,
      z: 3,
      rotationY: Math.PI * 3,
      moving: true,
      grounded: true,
      climbState: "none",
      convertSceneYToNative: (y) => y - 2
    })).toEqual({
      type: "state",
      x: 1,
      y: 3,
      z: 3,
      ry: Math.PI,
      anim: "walk"
    });

    expect(multiplayer.buildLocalBroadcastState({
      x: 0,
      y: 0,
      z: 0,
      rotationY: 0,
      moving: false,
      grounded: false,
      climbState: "none",
      convertSceneYToNative: (y) => y
    }).anim).toBe("jump");

    expect(multiplayer.buildLocalBroadcastState({
      x: 0,
      y: 0,
      z: 0,
      rotationY: 0,
      moving: false,
      grounded: true,
      climbState: "ladder",
      convertSceneYToNative: (y) => y
    }).anim).toBe("climb");
  });

  it("builds explicit state packets at scene positions", () => {
    const multiplayer = new MultiplayerService();

    expect(multiplayer.buildStateAtScenePosition({
      position: { x: 10, y: 20, z: 30 },
      rotationY: Math.PI * -3,
      anim: "jump",
      convertSceneYToNative: (y) => y + 2
    })).toEqual({
      type: "state",
      x: 10,
      y: 22,
      z: 30,
      ry: -Math.PI,
      anim: "jump"
    });
  });

  it("owns friend status lists for leaderboard integration", () => {
    const multiplayer = new MultiplayerService();
    multiplayer.replaceFriendLists(
      [{ id: 1 }],
      [{ from_user_id: 2 }],
      [{ toUserId: 3 }]
    );

    expect(multiplayer.friendStatus(1)).toBe("friends");
    expect(multiplayer.friendStatus(2)).toBe("request_received");
    expect(multiplayer.friendStatus(3)).toBe("request_sent");
    expect(multiplayer.friendStatus(4)).toBe("none");
    expect(multiplayer.friendStatusMap([1, 2, 4])).toEqual({
      1: "friends",
      2: "request_received",
      4: "none"
    });

    multiplayer.setFriendStatus(2, "friends");
    expect(multiplayer.friendStatus(2)).toBe("friends");
    multiplayer.setFriendStatus(2, "none");
    expect(multiplayer.friendStatus(2)).toBe("none");
  });

  it("fetches friend lists through one runtime method", async () => {
    const multiplayer = new MultiplayerService();
    const requests: string[] = [];
    const fetcher = (async (url: string) => {
      requests.push(url);
      const data: Record<string, unknown[]> = {
        "/api/friends": [{ id: 10 }],
        "/api/friends/requests/incoming": [{ from_user_id: 20 }],
        "/api/friends/requests/outgoing": [{ to_user_id: 30 }]
      };
      return {
        ok: true,
        json: async () => data[url] || []
      } as Response;
    }) as typeof fetch;

    await multiplayer.fetchAndReplaceFriendLists(fetcher);

    expect(requests).toEqual([
      "/api/friends",
      "/api/friends/requests/incoming",
      "/api/friends/requests/outgoing"
    ]);
    expect(multiplayer.friendStatusMap([10, 20, 30])).toEqual({
      10: "friends",
      20: "request_received",
      30: "request_sent"
    });
  });

  it("plans reconnect backoff and reset centrally", () => {
    const multiplayer = new MultiplayerService();

    expect(multiplayer.planReconnect("relay")).toMatchObject({
      shouldReconnect: true,
      exhausted: false,
      attempt: 1,
      delayMs: 1200,
      message: "Vortex Web relay disconnected. Reconnecting in 1.2s..."
    });
    expect(multiplayer.planReconnect("relay")).toMatchObject({
      shouldReconnect: true,
      attempt: 2
    });
    expect(multiplayer.planReconnect("relay", true)).toMatchObject({
      kicked: true,
      shouldReconnect: false
    });

    multiplayer.resetReconnect();
    expect(multiplayer.planReconnect("socket")).toMatchObject({
      attempt: 1,
      message: "Vortex Web socket disconnected. Reconnecting in 1.2s..."
    });

    for (let i = 0; i < 20; i += 1) multiplayer.planReconnect("relay");
    expect(multiplayer.planReconnect("relay")).toMatchObject({
      exhausted: true,
      shouldReconnect: false,
      message: "Vortex Web relay disconnected. Reload the page to retry."
    });
  });

  it("owns native-to-scene Y offset conversion", () => {
    const multiplayer = new MultiplayerService();

    expect(multiplayer.nativeFootOffset("2.5")).toBe(2.5);
    expect(multiplayer.nativeFootOffset("999")).toBe(2);
    expect(multiplayer.nativeYToSceneY(10, 2, 2.08)).toBeCloseTo(10.08);
    expect(multiplayer.sceneYToNativeY(10.08, 2, 2.08)).toBeCloseTo(10);
  });

  it("connects to a hosted relay and sends the versioned hello on open", async () => {
    const multiplayer = new MultiplayerService();
    const session = new MultiplayerSessionService();
    const platform = platformWithIdentity(hostedIdentity());
    const connection = new MultiplayerConnectionService(multiplayer, session, platform);
    const socket = fakeSocket();
    const chat: string[] = [];

    await connection.connectOnce({
      config: bridgeConfig({
        hubUrl: "wss://relay.example/ws",
        brokered: false,
        identity: hostedIdentity()
      }),
      currentLaunchInfo: null,
      setLaunchInfo: () => undefined,
      fallbackGameId: 3,
      fetcher: fetch,
      cryptoRef: crypto,
      createWebSocket: () => socket,
      handleMessage: () => undefined,
      handleNativePacket: () => undefined,
      encodeHeartbeat: () => new ArrayBuffer(0),
      chat: { system: (message) => chat.push(message) },
      joinAvatarOverride: () => null,
      applyJoinAvatarToLaunchInfo: () => null,
      hasAvatarSpoofAccess: () => false,
      syncPacketDebugAccess: () => undefined,
      scheduleReconnect: () => undefined
    });

    expect(session.connectFinished).toBe(true);
    expect(session.launchInfo?.id).toBe(18154);
    expect(chat[0]).toBe("Vortex Web connecting to relay");

    socket.onopen?.();
    expect(socket.sentJson()).toMatchObject({
      type: "hello",
      id: 18154,
      username: "monsterenergy",
      gameId: 7,
      shirt_id: 8,
      face_id: 56
    });
  });

  it("reports missing launch token before opening native websocket mode", async () => {
    const multiplayer = new MultiplayerService();
    const session = new MultiplayerSessionService();
    const connection = new MultiplayerConnectionService(multiplayer, session, platformWithIdentity(null));
    const chat: string[] = [];
    let opened = false;

    await connection.connectOnce({
      config: bridgeConfig({ launchToken: "", hubUrl: "", brokered: false, identity: null }),
      currentLaunchInfo: null,
      setLaunchInfo: () => undefined,
      fallbackGameId: 1,
      fetcher: fetch,
      cryptoRef: crypto,
      createWebSocket: () => {
        opened = true;
        return fakeSocket();
      },
      handleMessage: () => undefined,
      handleNativePacket: () => undefined,
      encodeHeartbeat: () => new ArrayBuffer(0),
      chat: { system: (message) => chat.push(message) },
      joinAvatarOverride: () => null,
      applyJoinAvatarToLaunchInfo: () => null,
      hasAvatarSpoofAccess: () => false,
      syncPacketDebugAccess: () => undefined,
      scheduleReconnect: () => undefined
    });

    expect(opened).toBe(false);
    expect(session.connectFinished).toBe(false);
    expect(chat).toEqual(["Vortex Web multiplayer is offline: missing launch token."]);
  });

  it("sends native heartbeat when a verified websocket endpoint is available", async () => {
    const multiplayer = new MultiplayerService();
    const session = new MultiplayerSessionService();
    const launchInfo = hostedIdentity({ wsEndpoint: "wss://native.example/ws", clientToken: "a".repeat(64) });
    const connection = new MultiplayerConnectionService(multiplayer, session, platformWithIdentity(launchInfo));
    const socket = fakeSocket();
    const handled: unknown[] = [];
    const heartbeat = new Uint8Array([1, 2, 3]).buffer;

    await connection.connectOnce({
      config: bridgeConfig({
        launchToken: "launch",
        hubUrl: "",
        brokered: false,
        identity: null
      }),
      currentLaunchInfo: launchInfo,
      setLaunchInfo: () => undefined,
      fallbackGameId: 1,
      fetcher: fetch,
      cryptoRef: crypto,
      createWebSocket: (url) => {
        expect(url).toBe("wss://native.example/ws");
        return socket;
      },
      handleMessage: (message) => handled.push(message),
      handleNativePacket: () => undefined,
      encodeHeartbeat: () => heartbeat,
      chat: { system: () => undefined },
      joinAvatarOverride: () => null,
      applyJoinAvatarToLaunchInfo: () => null,
      hasAvatarSpoofAccess: () => false,
      syncPacketDebugAccess: () => undefined,
      scheduleReconnect: () => undefined
    });

    expect(handled[0]).toMatchObject({ type: "init", id: 18154, username: "monsterenergy" });
    expect(session.connectFinished).toBe(true);

    socket.onopen?.();
    expect(socket.sent[0]).toBe(heartbeat);
  });
});

function bridgeConfig(patch: Partial<BridgeConfig> = {}): BridgeConfig {
  return {
    officialGameId: 1,
    customGameId: null,
    launchToken: "launch",
    hubUrl: "",
    brokered: false,
    devLocalRelay: false,
    devFeatures: false,
    identity: null,
    ...patch
  };
}

function hostedIdentity(patch: Partial<LaunchIdentity> = {}): LaunchIdentity {
  return {
    raw: {},
    id: 18154,
    username: "monsterenergy",
    gameId: 7,
    shirtId: 8,
    pantId: 0,
    bodyType: "male",
    bodyColors: ["#fff"],
    faceId: 56,
    clientToken: "client",
    requestedClientToken: "",
    wsEndpoint: null,
    ...patch
  };
}

function platformWithIdentity(identity: LaunchIdentity | null): PlatformBridge {
  return {
    resolveLaunchIdentity: async () => identity
  } as unknown as PlatformBridge;
}

function fakeSocket(): SocketLike & { sent: Array<string | ArrayBuffer>; sentJson(): Record<string, unknown> } {
  const socket = {
    readyState: 0,
    sent: [] as Array<string | ArrayBuffer>,
    send(data: string | ArrayBuffer) {
      socket.sent.push(data);
    },
    close() {
      socket.readyState = 3;
    },
    sentJson() {
      return JSON.parse(String(socket.sent.at(-1) || "{}")) as Record<string, unknown>;
    }
  };
  return socket;
}
