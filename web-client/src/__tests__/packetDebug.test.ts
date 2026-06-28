import { describe, expect, it } from "vitest";
import { PacketDebugService } from "../network/PacketDebugService";

describe("PacketDebugService", () => {
  it("records player snapshots only when enabled or tracking spoof echoes", () => {
    const storage = memoryStorage();
    const service = new PacketDebugService(storage);
    const normalize = (value: unknown) => ({
      shirt_id: Number((value as { shirt_id?: unknown })?.shirt_id || 0),
      pant_id: Number((value as { pant_id?: unknown })?.pant_id || 0),
      body_type: String((value as { body_type?: unknown })?.body_type || "male"),
      body_colors: (value as { body_colors?: unknown[] })?.body_colors || [],
      face_id: Number((value as { face_id?: unknown })?.face_id || 0)
    });

    expect(service.recordReplicatedPlayers("states", [{ id: 1, username: "a" }], { normalizeAvatar: normalize })).toEqual([]);

    service.setEnabled(true);
    expect(storage.getItem("vwebPacketDebug")).toBe("1");
    const batch = service.recordReplicatedPlayers("states", [{
      id: 1,
      username: "a",
      shirt_id: 8,
      pant_id: 2,
      body_type: "male",
      body_colors: ["#1", "#2", "#3", "#4", "#5", "#6"],
      face_id: 56
    }], { normalizeAvatar: normalize, fallbackGameId: 3, now: 2000 });

    expect(batch).toMatchObject([{ id: 1, username: "a", game: 3, shirt_id: 8, source: "states" }]);
    expect(service.players()).toHaveLength(1);
    expect(service.history()).toHaveLength(1);
  });

  it("tracks spoof echo latency and probe/leave history", () => {
    const service = new PacketDebugService(memoryStorage());
    service.setEnabled(true);
    const normalize = (value: unknown) => ({
      shirt_id: Number((value as { shirt_id?: unknown })?.shirt_id || 0),
      pant_id: 0,
      body_type: "male",
      body_colors: [],
      face_id: 0
    });

    const seq = service.addPendingSpoof({
      shirt_id: 10,
      pant_id: 0,
      body_type: "male",
      body_colors: [],
      face_id: 0
    }, normalize, 100);
    service.recordReplicatedPlayers("states", [{ id: 5, shirt_id: 10 }], { normalizeAvatar: normalize, now: 250 });

    expect(seq).toBe(1);
    expect(service.latencies()).toMatchObject([{ seq: 1, latency_ms: 150 }]);

    expect(service.recordLeave(5, "remote")).toMatchObject({ id: 5, username: "remote" });
    expect(service.leaves()).toHaveLength(1);

    service.recordProbeEvent({ type: "probe_requested", case: "append_tail" });
    expect(service.probes()).toMatchObject([{ type: "probe_requested", case: "append_tail" }]);
  });

  it("syncs access by clearing storage when not allowed", () => {
    const storage = memoryStorage();
    const service = new PacketDebugService(storage);

    service.setEnabled(true);
    expect(service.syncAccess(false)).toBe(false);
    expect(service.enabled).toBe(false);
    expect(storage.getItem("vwebPacketDebug")).toBeNull();
  });

  it("owns random spoof timer setup and stop", () => {
    const service = new PacketDebugService(memoryStorage());
    const outbound: unknown[] = [];
    const randomStates: unknown[] = [];
    const cleared: unknown[] = [];

    const result = service.startRandomSpoof({ count: 1, MultiThread: 2, intervalMs: 10, PosRand: true }, {
      bridgeOpen: () => true,
      bridgeSend: (payload) => randomStates.push(payload),
      setOutboundAvatar: (patch, options) => outbound.push({ patch, options }),
      setTimeoutRef: ((handler: () => void) => {
        handler();
        return 1;
      }) as unknown as typeof setTimeout,
      setIntervalRef: (() => 99) as unknown as typeof setInterval,
      clearIntervalRef: ((timer: unknown) => cleared.push(timer)) as typeof clearInterval
    });

    expect(result).toMatchObject({ running: true, threads: 2, intervalMs: 50, countPerThread: 1, totalExpected: 2 });
    expect(outbound).toHaveLength(2);
    expect(randomStates).toHaveLength(2);
    expect(outbound[0]).toMatchObject({
      options: {
        measure: true,
        flush: true,
        rebuild: true,
        rebuildRemotes: false
      }
    });

    expect(service.stopRandomSpoof(((timer: unknown) => cleared.push(timer)) as typeof clearInterval)).toBe(true);
  });
});

function memoryStorage(): Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}
