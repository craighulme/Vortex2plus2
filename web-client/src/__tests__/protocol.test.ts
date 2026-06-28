import { describe, expect, it } from "vitest";
import { createProtocolService } from "../network/protocol";

describe("ProtocolService", () => {
  function fullBatchFromMovement(movement: ArrayBuffer, username: string, roleFlags: number): ArrayBuffer {
    const packet = new ArrayBuffer(12 + movement.byteLength - 4);
    const packetView = new DataView(packet);
    packetView.setUint32(0, 1, true);
    packetView.setBigUint64(4, 1n, true);
    new Uint8Array(packet, 12).set(new Uint8Array(movement, 4));
    packetView.setUint8(12 + 24 + username.length, roleFlags);
    return packet;
  }

  it("accepts current relay server messages", () => {
    const protocol = createProtocolService();

    expect(protocol.isServerMessage({ type: "init", id: 1, username: "me", players: [] })).toBe(true);
    expect(protocol.isServerMessage({ type: "join", id: 2, username: "remote" })).toBe(true);
    expect(protocol.isServerMessage({ type: "states", players: [{ id: 2 }] })).toBe(true);
    expect(protocol.isServerMessage({ type: "leave", id: 2 })).toBe(true);
    expect(protocol.isServerMessage({ type: "chat", id: 2, msg: "hi" })).toBe(true);
  });

  it("encodes and parses native chat packets", () => {
    const protocol = createProtocolService();
    const packet = protocol.encodeChatPacket("hello", { id: 18154, username: "monsterenergy" });

    expect(protocol.parseChatPacket(packet)).toEqual({
      playerId: 18154,
      username: "monsterenergy",
      message: "hello"
    });
    expect(protocol.parsePlayersPacket(packet)).toBeNull();
    expect(protocol.nativePacketMessages(packet, { selfId: 1, hasRemote: () => false })).toEqual([{
      type: "chat",
      id: 18154,
      username: "monsterenergy",
      msg: "hello",
      is_staff: false,
      is_owner: false,
      is_booster: false
    }]);
  });

  it("classifies native system messages", () => {
    const protocol = createProtocolService();

    expect(protocol.classifySystemMessage("Slow down, wait 3 seconds")).toEqual({ type: "chat_throttled", wait: 3 });
    expect(protocol.classifySystemMessage("message blocked by moderation")).toEqual({ type: "chat_blocked", msg: "message blocked by moderation" });
    expect(protocol.classifySystemMessage("already playing on another window")).toEqual({ type: "system_red", msg: "already playing on another window" });
    expect(protocol.classifySystemMessage("connected")).toEqual({ type: "system", msg: "connected" });
  });

  it("encodes movement packets and advances animation clock outside override code", () => {
    const protocol = createProtocolService();
    const encoded = protocol.encodeMovementPacket(
      { x: 1, y: 2, z: 3, ry: 0.5, anim: "walk" },
      {
        id: 18154,
        gameId: 3,
        username: "monsterenergy",
        bodyColors: ["#ff0000", "#00ff00", "#0000ff", "#ffffff", "#111111", "#222222"],
        bodyType: "male",
        shirtId: 8,
        pantId: 2,
        faceId: 56
      },
      1
    );
    const view = new DataView(encoded.buffer);

    expect(encoded.animClock).toBeCloseTo(1.05);
    expect(view.getUint32(0, true)).toBe(0);
    expect(encoded.buffer.byteLength).toBeGreaterThan(60);
  });

  it("converts native player records into relay-style player states", () => {
    const protocol = createProtocolService();

    expect(protocol.convertNativePlayers([
      {
        id: 1,
        game: 3,
        name: "self",
        x: 0,
        y: 0,
        z: 0,
        yaw: 0,
        state0: 0,
        state1: 1,
        animTime: 0,
        roleFlags: 0,
        shirtId: 0,
        pantId: 0,
        bodyType: "male",
        bodyColors: [],
        faceId: 0,
        hasAvatar: false,
        valid: true,
        floatOffset: 0,
        recordBytes: 22
      },
      {
        id: 2,
        game: 3,
        name: "remote",
        x: 1,
        y: 2,
        z: 3,
        yaw: 0.5,
        state0: 1,
        state1: 1,
        animTime: 0,
        roleFlags: 4,
        shirtId: 8,
        pantId: 2,
        bodyType: "female",
        bodyColors: ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666"],
        faceId: 56,
        hasAvatar: true,
        valid: true,
        floatOffset: 0,
        recordBytes: 55
      }
    ], 1)).toEqual([{
      id: 2,
      username: "remote",
      is_staff: false,
      is_booster: false,
      x: 1,
      y: 2,
      z: 3,
      ry: 0.5,
      anim: "walk",
      role_flags: 4,
      shirt_id: 8,
      pant_id: 2,
      body_type: "female",
      body_colors: ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666"],
      face_id: 56
    }]);
  });

  it("preserves native role flag bytes from full player records", () => {
    const protocol = createProtocolService();
    const player = {
      id: 1346,
      gameId: 8,
      username: "Kid",
      bodyColors: ["#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff", "#ffffff"],
      bodyType: "male",
      shirtId: 9,
      pantId: 24,
      faceId: 47
    };
    const movement = protocol.encodeMovementPacket({ x: 10, y: 20, z: 30, ry: 0.5, anim: "idle" }, player, 1).buffer;
    const records = protocol.parsePlayersPacket(fullBatchFromMovement(movement, player.username, 0x04));

    expect(records?.[0]).toMatchObject({
      id: 1346,
      name: "Kid",
      roleFlags: 0x04,
      x: 10,
      y: 20,
      z: 30
    });
  });
});
