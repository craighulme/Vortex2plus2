import { describe, expect, it } from "vitest";
import { createProtocolService } from "../network/protocol";

describe("ProtocolService", () => {
  it("accepts current relay server messages", () => {
    const protocol = createProtocolService();

    expect(protocol.isServerMessage({ type: "init", id: 1, username: "me", players: [] })).toBe(true);
    expect(protocol.isServerMessage({ type: "join", id: 2, username: "remote" })).toBe(true);
    expect(protocol.isServerMessage({ type: "states", players: [{ id: 2 }] })).toBe(true);
    expect(protocol.isServerMessage({ type: "leave", id: 2 })).toBe(true);
    expect(protocol.isServerMessage({ type: "chat", id: 2, msg: "hi" })).toBe(true);
  });
});
