import { describe, expect, it } from "vitest";
import { MultiplayerSessionService } from "../network/relay/MultiplayerSessionService";

describe("MultiplayerSessionService", () => {
  it("guards duplicate connect attempts", async () => {
    const session = new MultiplayerSessionService();
    let calls = 0;
    const connectOnce = async () => {
      calls += 1;
      return "ok";
    };

    const first = session.runConnect(connectOnce, () => false);
    const second = session.runConnect(connectOnce, () => false);

    expect(first).toBe(second);
    expect(await first).toBe("ok");
    expect(calls).toBe(1);

    session.connectFinished = true;
    expect(session.runConnect(connectOnce, () => false)).toBeUndefined();
  });

  it("routes hub payloads as JSON and native payloads through encoders", () => {
    const session = new MultiplayerSessionService();
    const sent: Array<string | ArrayBuffer> = [];
    session.socket = { send: (data) => sent.push(data) };
    session.launchInfo = launchInfo();

    session.hubMode = true;
    expect(session.sendPayload({ type: "state", x: 1, y: 2, z: 3, ry: 0, anim: "idle" }, encoders())).toBe(true);
    expect(sent[0]).toBe(JSON.stringify({ type: "state", x: 1, y: 2, z: 3, ry: 0, anim: "idle" }));

    sent.length = 0;
    session.hubMode = false;
    expect(session.sendPayload({ type: "state", x: 1, y: 2, z: 3, ry: 0, anim: "idle" }, encoders())).toBe(true);
    expect(sent[0]).toBeInstanceOf(ArrayBuffer);
    expect((sent[0] as ArrayBuffer).byteLength).toBe(4);

    expect(session.sendPayload({ type: "unknown" }, encoders())).toBe(false);
  });

  it("updates launch avatar without replacing identity", () => {
    const session = new MultiplayerSessionService();
    const info = launchInfo();
    session.launchInfo = info;

    expect(session.updateLaunchAvatar({
      shirt_id: 9,
      pant_id: 2,
      body_type: "female",
      body_colors: ["#000"],
      face_id: 7
    })).toMatchObject({ shirt_id: 9 });

    expect(info).toMatchObject({
      shirtId: 9,
      pantId: 2,
      bodyType: "female",
      bodyColors: ["#000"],
      faceId: 7
    });
  });

  it("owns broadcast timers and temporary override state", () => {
    const session = new MultiplayerSessionService();
    const ticks: Array<() => void> = [];
    const cleared: unknown[] = [];

    expect(session.startBroadcast({
      setInterval: ((handler: () => void) => {
        ticks.push(handler);
        return 123;
      }) as typeof setInterval,
      intervalMs: 50,
      tick: () => ticks.push(() => undefined)
    })).toBe(true);
    expect(session.startBroadcast({
      setInterval: (() => 456) as unknown as typeof setInterval,
      intervalMs: 50,
      tick: () => undefined
    })).toBe(false);
    expect(session.snapshot()).toMatchObject({ broadcasting: true });

    session.stopBroadcast(((timer: unknown) => cleared.push(timer)) as typeof clearInterval);
    expect(cleared).toEqual([123]);
    expect(session.snapshot()).toMatchObject({ broadcasting: false });

    session.holdBroadcastState({ type: "state", x: 1 }, 250, 1000);
    expect(session.consumeBroadcastOverride(1100)).toEqual({ type: "state", x: 1 });
    expect(session.consumeBroadcastOverride(1301)).toBeNull();
  });

  it("binds broadcast timer functions to the global receiver", () => {
    const session = new MultiplayerSessionService();
    const originalFlag = (globalThis as { __timerReceiver?: boolean }).__timerReceiver;
    (globalThis as { __timerReceiver?: boolean }).__timerReceiver = true;

    try {
      expect(session.startBroadcast({
        setInterval: function (this: { __timerReceiver?: boolean }, _handler: TimerHandler, _timeout?: number) {
          if (!this.__timerReceiver) throw new TypeError("Illegal invocation");
          return 999;
        } as unknown as typeof setInterval,
        intervalMs: 50,
        tick: () => undefined
      })).toBe(true);

      const cleared: unknown[] = [];
      session.stopBroadcast(function (this: { __timerReceiver?: boolean }, timer: unknown) {
        if (!this.__timerReceiver) throw new TypeError("Illegal invocation");
        cleared.push(timer);
      } as unknown as typeof clearInterval);

      expect(cleared).toEqual([999]);
    } finally {
      if (originalFlag === undefined) {
        delete (globalThis as { __timerReceiver?: boolean }).__timerReceiver;
      } else {
        (globalThis as { __timerReceiver?: boolean }).__timerReceiver = originalFlag;
      }
    }
  });

  it("owns state burst timing clamps and timer binding", () => {
    const session = new MultiplayerSessionService();
    const sent: unknown[] = [];
    const delays: number[] = [];
    const originalFlag = (globalThis as { __timerReceiver?: boolean }).__timerReceiver;
    (globalThis as { __timerReceiver?: boolean }).__timerReceiver = true;

    try {
      const result = session.sendStateBurst({ type: "state", x: 1 }, {
        count: 99,
        intervalMs: 1,
        setTimeoutRef: function (this: { __timerReceiver?: boolean }, handler: () => void, timeout?: number) {
          if (!this.__timerReceiver) throw new TypeError("Illegal invocation");
          delays.push(Number(timeout || 0));
          handler();
          return 1 as unknown as ReturnType<typeof setTimeout>;
        } as unknown as typeof setTimeout,
        send: (state) => sent.push(state)
      });

      expect(result).toEqual({ total: 12, intervalMs: 20 });
      expect(delays).toEqual([0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220]);
      expect(sent).toHaveLength(12);
    } finally {
      if (originalFlag === undefined) {
        delete (globalThis as { __timerReceiver?: boolean }).__timerReceiver;
      } else {
        (globalThis as { __timerReceiver?: boolean }).__timerReceiver = originalFlag;
      }
    }
  });

  it("owns broadcast tick flow for overrides, unchanged state, and sent state", () => {
    const session = new MultiplayerSessionService();
    const sent: unknown[] = [];
    const character = { position: { x: 1, y: 2, z: 3 }, rotation: { y: 0 } };

    session.holdBroadcastState({ type: "state", x: 9 }, 250, 1000);
    expect(session.runBroadcastTick({
      isOpen: () => true,
      getCharacter: () => character,
      buildState: () => ({ type: "state", x: 1 }),
      shouldBroadcast: () => true,
      encode: (state) => ({ encoded: state }),
      send: (payload) => sent.push(payload)
    })).toBe("override");
    expect(sent).toEqual([{ type: "state", x: 9 }]);

    expect(session.runBroadcastTick({
      isOpen: () => true,
      getCharacter: () => character,
      buildState: () => ({ type: "state", x: 1 }),
      shouldBroadcast: () => false,
      encode: (state) => ({ encoded: state }),
      send: (payload) => sent.push(payload),
      now: 1301
    })).toBe("unchanged");
    expect(sent).toHaveLength(1);

    expect(session.runBroadcastTick({
      isOpen: () => true,
      getCharacter: () => character,
      buildState: () => ({ type: "state", x: 2 }),
      shouldBroadcast: () => true,
      encode: (state) => ({ encoded: state }),
      send: (payload) => sent.push(payload),
      now: 1301
    })).toBe("sent");
    expect(sent[1]).toEqual({ encoded: { type: "state", x: 2 } });
  });

  it("attaches hub socket handlers and reports bad JSON", () => {
    const session = new MultiplayerSessionService();
    const socket = fakeSocket();
    const events: string[] = [];

    session.attachHubSocket(socket, {
      onOpen: () => events.push("open"),
      onMessage: (message) => events.push(`message:${(message as { type?: unknown }).type}`),
      onBadMessage: () => events.push("bad"),
      onClose: () => events.push("close"),
      onError: () => events.push("error")
    });

    socket.onopen?.();
    socket.onmessage?.({ data: JSON.stringify({ type: "init" }) });
    socket.onmessage?.({ data: "{" });
    socket.onclose?.();
    socket.onerror?.();

    expect(events).toEqual(["open", "message:init", "bad", "close", "error"]);
    expect(socket.closed).toBe(true);
    expect(session.snapshot()).toMatchObject({ connected: true, hubMode: true });
  });

  it("attaches native socket handlers for binary and JSON packets", () => {
    const session = new MultiplayerSessionService();
    const socket = fakeSocket();
    const events: string[] = [];

    session.attachNativeSocket(socket, {
      onOpen: () => events.push("open"),
      onNativePacket: (buffer) => events.push(`packet:${buffer.byteLength}`),
      onJsonMessage: (message) => events.push(`json:${(message as { type?: unknown }).type}`),
      onBadMessage: () => events.push("bad"),
      onClose: () => events.push("close"),
      onError: () => events.push("error")
    });

    socket.onopen?.();
    socket.onmessage?.({ data: new ArrayBuffer(3) });
    socket.onmessage?.({ data: JSON.stringify({ type: "system" }) });
    socket.onmessage?.({ data: "{" });

    expect(socket.binaryType).toBe("arraybuffer");
    expect(events).toEqual(["open", "packet:3", "json:system", "bad"]);
    expect(session.snapshot()).toMatchObject({ connected: true, hubMode: false });
  });
});

function encoders() {
  return {
    encodeMovement: () => new ArrayBuffer(4),
    encodeChat: () => new ArrayBuffer(2)
  };
}

function launchInfo() {
  return {
    raw: {},
    id: 1,
    username: "player",
    gameId: 3,
    shirtId: 0,
    pantId: 0,
    bodyType: "male",
    bodyColors: [],
    faceId: 0,
    clientToken: "",
    requestedClientToken: "",
    wsEndpoint: null
  };
}

function fakeSocket() {
  return {
    sent: [] as Array<string | ArrayBuffer>,
    closed: false,
    binaryType: "",
    send(data: string | ArrayBuffer) {
      this.sent.push(data);
    },
    close() {
      this.closed = true;
    },
    onopen: null as (() => void) | null,
    onmessage: null as ((event: { data: unknown }) => void) | null,
    onclose: null as (() => void) | null,
    onerror: null as (() => void) | null
  };
}
