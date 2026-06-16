import dgram from "node:dgram";
import crypto from "node:crypto";
import { WebSocketServer } from "ws";

const listenHost = process.env.V22_RELAY_HOST || "127.0.0.1";
const listenPort = Number(process.env.V22_RELAY_PORT || 27822);
const nativeHost = process.env.VORTEX_NATIVE_HOST || "connect.playvortex.io";
const nativePort = Number(process.env.VORTEX_NATIVE_PORT || 7777);
const heartbeatType = Number(process.env.V22_HEARTBEAT_TYPE || 6);

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const wss = new WebSocketServer({ host: listenHost, port: listenPort });

console.log(`[native-relay] listening ws://${listenHost}:${listenPort}/ws`);
console.log(`[native-relay] native UDP ${nativeHost}:${nativePort}`);
console.log(`[native-relay] heartbeat packet type=${heartbeatType}`);

wss.on("connection", (ws, req) => {
  const url = new URL(req.url || "/ws", `ws://${req.headers.host || `${listenHost}:${listenPort}`}`);
  const game = safeInt(url.searchParams.get("game"));
  const session = new NativeSession(ws, game);
  console.log(`[native-relay] browser connected game=${game || "unknown"}`);
  ws.on("message", (data) => session.onBrowserMessage(data));
  ws.on("close", () => session.close());
  ws.on("error", () => session.close());
});

class NativeSession {
  constructor(ws, requestedGame) {
    this.ws = ws;
    this.requestedGame = requestedGame;
    this.udp = null;
    this.player = null;
    this.authTokens = [];
    this.authIndex = 0;
    this.tokenSource = "none";
    this.heartbeatTimer = null;
    this.authFallbackTimer = null;
    this.statsTimer = null;
    this.bootstrapTimer = null;
    this.joined = new Set();
    this.recvPackets = 0;
    this.sendPackets = 0;
    this.lastAnimClock = 0;
    this.lastState = { x: 0, y: 0, z: 0, ry: 0, anim: "idle" };
    this.browserStateSeen = false;
  }

  onBrowserMessage(data) {
    let msg;
    try {
      msg = JSON.parse(Buffer.isBuffer(data) ? data.toString("utf8") : String(data));
    } catch {
      return;
    }

    if (msg.type === "hello") {
      this.start(msg).catch((err) => {
        console.warn(`[native-relay] start failed: ${err?.message || err}`);
        this.close(1011, "start failed");
      });
      return;
    }

    if (!this.player || !this.udp) return;

    if (msg.type === "state") {
      this.browserStateSeen = true;
      this.lastState = {
        x: Number(msg.x || 0),
        y: Number(msg.y || 0),
        z: Number(msg.z || 0),
        ry: Number(msg.ry || 0),
        anim: String(msg.anim || "idle"),
      };
      this.sendNative(encodeMovement(this.player, msg, this.nextAnimClock()));
      return;
    }

    if (msg.type === "chat") {
      const text = String(msg.msg || "").slice(0, 512);
      if (text.trim()) this.sendNative(encodeChat(this.player, text));
    }
  }

  async start(hello) {
    if (this.player) return;

    const verified = await verifyLaunchToken(hello.launchToken);
    const browserIdentity = hasBrowserIdentity(hello);
    const identity = verified.id ? verified : browserIdentity;

    this.authTokens = chooseAuthTokens(hello, verified);
    if (!this.authTokens.length) {
      this.close(1008, "missing auth token");
      return;
    }

    this.player = {
      id: safeInt(identity.id),
      username: safeName(identity.username),
      gameId: safeInt(identity.gameId) || this.requestedGame,
      shirtId: safeInt(identity.shirtId),
      pantId: safeInt(identity.pantId),
      bodyType: safeBodyType(identity.bodyType),
      bodyColors: safeBodyColors(identity.bodyColors),
      faceId: safeInt(identity.faceId),
    };

    if (!this.player.id || !this.player.gameId) {
      this.close(1008, "invalid identity");
      return;
    }

    this.tokenSource = this.authTokens[0].source;
    this.openUdpSocket();
    this.sendBrowser({
      type: "init",
      id: this.player.id,
      username: this.player.username,
      game_id: this.player.gameId,
      is_staff: false,
      is_booster: false,
      shirt_id: this.player.shirtId || 0,
      pant_id: this.player.pantId || 0,
      body_type: this.player.bodyType,
      body_colors: this.player.bodyColors,
      face_id: this.player.faceId || 0,
      players: [],
    });

    this.sendHeartbeat();
    this.startBootstrapMovement();
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), 4000);
    this.authFallbackTimer = setInterval(() => this.rotateAuthIfNeeded(), 3000);
    this.statsTimer = setInterval(() => {
      console.log(`[native-relay] ${this.player.username} game=${this.player.gameId} sends=${this.sendPackets} recvs=${this.recvPackets} players=${this.joined.size} token=${this.tokenSource}`);
    }, 5000);

    console.log(`[native-relay] ${this.player.username} #${this.player.id} game=${this.player.gameId} started token=${this.tokenSource}`);
  }

  openUdpSocket() {
    if (this.udp) {
      try { this.udp.close(); } catch {}
    }
    this.udp = dgram.createSocket("udp4");
    this.udp.on("message", (buf) => this.onNativeMessage(buf));
    this.udp.on("error", (err) => {
      console.warn(`[native-relay] udp error ${err.message}`);
      this.close();
    });
  }

  rotateAuthIfNeeded() {
    if (this.recvPackets > 0) {
      clearInterval(this.authFallbackTimer);
      this.authFallbackTimer = null;
      return;
    }

    if (this.authIndex + 1 >= this.authTokens.length) return;
    this.authIndex += 1;
    this.tokenSource = this.authTokens[this.authIndex].source;
    this.openUdpSocket();
    console.warn(`[native-relay] ${this.player?.username || "unknown"} no native replies; retrying ${this.tokenSource}`);
    this.sendHeartbeat();
  }

  sendHeartbeat() {
    const token = this.authTokens[this.authIndex]?.value;
    if (token) this.sendNative(encodeHeartbeat(token));
  }

  startBootstrapMovement() {
    let ticks = 0;
    this.bootstrapTimer = setInterval(() => {
      ticks += 1;
      if (!this.udp || this.recvPackets > 0 || ticks > 30) {
        clearInterval(this.bootstrapTimer);
        this.bootstrapTimer = null;
        return;
      }
      this.sendNative(encodeMovement(this.player, this.lastState, this.nextAnimClock()));
    }, 100);
  }

  sendNative(buf) {
    if (!this.udp) return;
    this.sendPackets += 1;
    this.udp.send(buf, nativePort, nativeHost);
  }

  onNativeMessage(buf) {
    this.recvPackets += 1;

    const players = parsePlayersPacket(buf);
    if (players) {
      const states = players
        .filter((p) => p.id !== this.player?.id)
        .map((p) => ({
          id: p.id,
          username: p.name,
          is_staff: false,
          is_booster: false,
          shirt_id: p.shirtId || 0,
          x: p.x,
          y: p.y,
          z: p.z,
          ry: p.yaw,
          anim: p.state1 === 0 ? "jump" : p.state0 ? "walk" : "idle",
        }));

      for (const p of states) {
        if (!this.joined.has(p.id)) {
          this.joined.add(p.id);
          console.log(`[native-relay] player ${p.username} #${p.id}`);
          this.sendBrowser({ type: "join", ...p });
        }
      }

      this.sendBrowser({ type: "states", players: states });
      return;
    }

    const chat = parseChatPacket(buf);
    if (chat) {
      this.sendBrowser({
        type: "chat",
        id: chat.playerId,
        username: chat.username,
        msg: chat.message,
        is_staff: false,
        is_owner: false,
        is_booster: false,
      });
    }
  }

  sendBrowser(payload) {
    try {
      if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(payload));
    } catch {
      this.close();
    }
  }

  nextAnimClock() {
    this.lastAnimClock += 0.05;
    return this.lastAnimClock;
  }

  close(code, reason) {
    if (this.authFallbackTimer) clearInterval(this.authFallbackTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.statsTimer) clearInterval(this.statsTimer);
    if (this.bootstrapTimer) clearInterval(this.bootstrapTimer);
    this.authFallbackTimer = null;
    this.heartbeatTimer = null;
    this.statsTimer = null;
    this.bootstrapTimer = null;

    if (this.udp) {
      try { this.udp.close(); } catch {}
      this.udp = null;
    }

    if (code && this.ws.readyState === this.ws.OPEN) {
      try { this.ws.close(code, reason); } catch {}
    }
  }
}

async function verifyLaunchToken(launchToken) {
  const token = String(launchToken || "").trim();
  if (!/^[a-f0-9]{64}$/i.test(token)) return {};

  const requestedClientToken = crypto.randomBytes(32).toString("hex");
  try {
    const res = await fetch(`https://playvortex.io/api/verify-launch?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
      headers: {
        accept: "application/json",
        "user-agent": "Vortex/0.1.93",
        "X-Client-Token": requestedClientToken,
      },
    });

    if (!res.ok) {
      console.warn(`[native-relay] verify-launch HTTP ${res.status}`);
      return {};
    }

    const raw = await res.json();
    return {
      clientToken: raw.client_token || raw.clientToken || "",
      appToken: raw.app_token || raw.appToken || "",
      requestedClientToken,
      id: raw.user_id || raw.userId || raw.id || 0,
      username: raw.username || raw.name || "",
      gameId: raw.game_id || raw.gameId || raw.game || 0,
      shirtId: raw.shirt_id || raw.shirtId || 0,
      pantId: raw.pant_id || raw.pantId || 0,
      bodyType: raw.body_type || raw.bodyType || "male",
      bodyColors: raw.body_colors || raw.bodyColors || [],
      faceId: raw.face_id || raw.faceId || 0,
    };
  } catch (err) {
    console.warn(`[native-relay] verify-launch failed: ${err?.message || err}`);
    return {};
  }
}

function hasBrowserIdentity(hello) {
  return {
    clientToken: hello.clientToken || "",
    appToken: hello.appToken || "",
    id: safeInt(hello.id),
    username: safeName(hello.username),
    gameId: safeInt(hello.gameId),
    shirtId: safeInt(hello.shirt_id || hello.shirtId),
    pantId: safeInt(hello.pant_id || hello.pantId),
    bodyType: safeBodyType(hello.body_type || hello.bodyType),
    bodyColors: safeBodyColors(hello.body_colors || hello.bodyColors),
    faceId: safeInt(hello.face_id || hello.faceId),
  };
}

function chooseAuthTokens(hello, verified) {
  const candidates = [
    ["env", process.env.V22_NATIVE_AUTH_TOKEN],
    ["serverClientToken", verified.clientToken],
    ["clientToken", hello.clientToken],
    ["requestedClientToken", verified.requestedClientToken],
    ["serverAppToken", verified.appToken],
    ["appToken", hello.appToken],
    ["launchToken", hello.launchToken],
  ];
  const seen = new Set();
  const out = [];

  for (const [source, value] of candidates) {
    const token = String(value || "").trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(token) || seen.has(token)) continue;
    seen.add(token);
    out.push({ source, value: token });
  }

  return out;
}

function encodeHeartbeat(token) {
  const bytes = encoder.encode(token.slice(0, 64));
  const buf = Buffer.alloc(12 + bytes.length);
  buf.writeUInt32LE(heartbeatType, 0);
  writeU64(buf, 4, bytes.length);
  Buffer.from(bytes).copy(buf, 12);
  return buf;
}

function encodeMovement(player, data, animClock) {
  const nameBytes = encoder.encode(player.username);
  const buf = Buffer.alloc(4 + 8 + 8 + 8 + nameBytes.length + 1 + 16 + 2 + 4 + 33);
  let off = 0;
  buf.writeUInt32LE(0, off); off += 4;
  writeU64(buf, off, player.id); off += 8;
  writeU64(buf, off, player.gameId); off += 8;
  writeU64(buf, off, nameBytes.length); off += 8;
  Buffer.from(nameBytes).copy(buf, off); off += nameBytes.length;
  buf.writeUInt8(2, off); off += 1;
  buf.writeFloatLE(Number(data.x || 0), off); off += 4;
  buf.writeFloatLE(Number(data.y || 0), off); off += 4;
  buf.writeFloatLE(Number(data.z || 0), off); off += 4;
  buf.writeFloatLE(Number(data.ry || 0), off); off += 4;

  const anim = String(data.anim || "idle");
  buf.writeUInt8(anim === "idle" ? 0 : 1, off); off += 1;
  buf.writeUInt8(anim === "jump" ? 0 : 1, off); off += 1;
  buf.writeFloatLE(animClock, off); off += 4;
  buf.writeUInt8((player.shirtId || 0) & 0xff, off); off += 1;
  buf.writeUInt8((player.pantId || 0) & 0xff, off); off += 1;
  buf.writeUInt8(0, off); off += 1;
  const colors = safeBodyColors(player.bodyColors);
  for (let i = 0; i < 6; i += 1) {
    buf.writeUInt32LE(colorToPacketInt(colors[i]), off);
    off += 4;
  }
  buf.writeUInt8(player.bodyType === "female" ? 2 : 1, off); off += 1;
  buf.writeUInt32LE(player.faceId || 0, off); off += 4;
  buf.writeUInt8(0, off);
  return buf;
}

function encodeChat(player, msg) {
  const name = encoder.encode(player.username);
  const text = encoder.encode(String(msg || "").slice(0, 512));
  const buf = Buffer.alloc(4 + 8 + 8 + name.length + 8 + text.length + 1);
  let off = 0;
  buf.writeUInt32LE(2, off); off += 4;
  writeU64(buf, off, player.id); off += 8;
  writeU64(buf, off, name.length); off += 8;
  Buffer.from(name).copy(buf, off); off += name.length;
  writeU64(buf, off, text.length); off += 8;
  Buffer.from(text).copy(buf, off); off += text.length;
  buf.writeUInt8(0, off);
  return buf;
}

function parsePlayersPacket(buf) {
  if (buf.length < 16 || buf.readUInt32LE(0) !== 1) return null;
  const expected = readU64(buf, 4);
  if (expected == null) return null;

  const records = [];
  let off = 12;
  while (off + 32 < buf.length && records.length < 64 && (!expected || records.length < expected)) {
    const rec = parseMovementRecord(buf, off, false);
    if (!rec) break;
    records.push(rec);
    const next = findNextRecord(buf, off, rec);
    if (next == null) break;
    off = next;
  }

  return records;
}

function parseMovementRecord(buf, offset, hasPacketType) {
  const start = offset + (hasPacketType ? 4 : 0);
  if (buf.length < start + 34) return null;

  const id = readU64(buf, start);
  const game = readU64(buf, start + 8);
  const nameLen = readU64(buf, start + 16);
  if (id == null || game == null || !nameLen || nameLen > 64) return null;

  const nameOff = start + 24;
  if (nameOff + nameLen > buf.length) return null;

  const name = decoder.decode(buf.subarray(nameOff, nameOff + nameLen));
  if (!asciiOk(name)) return null;

  const firstFloat = nameOff + nameLen;
  const offsets = [firstFloat + 1, firstFloat, firstFloat + 2];
  let best = null;

  for (const foff of offsets) {
    if (foff + 22 > buf.length) continue;

    const x = buf.readFloatLE(foff);
    const y = buf.readFloatLE(foff + 4);
    const z = buf.readFloatLE(foff + 8);
    const yaw = buf.readFloatLE(foff + 12);
    if (![x, y, z, yaw].every(Number.isFinite)) continue;
    if (Math.abs(x) > 1000000 || Math.abs(y) > 1000000 || Math.abs(z) > 1000000) continue;

    const state0 = buf.readUInt8(foff + 16);
    const state1 = buf.readUInt8(foff + 17);
    if (state0 > 2 || state1 > 2) continue;

    const shirtId = readShirtId(buf, foff);
    const rec = {
      id,
      game,
      name,
      x,
      y,
      z,
      yaw,
      state0,
      state1,
      animTime: foff + 22 <= buf.length ? buf.readFloatLE(foff + 18) : 0,
      shirtId,
      floatOffset: foff - offset,
    };

    let score = 0;
    if (state0 <= 1 && state1 <= 1) score += 100;
    if (Math.abs(yaw) <= 8) score += 20;
    if (foff === firstFloat + 1) score += 2;
    if (!best || score > best.score) best = { rec, score };
  }

  return best?.rec || null;
}

function readShirtId(buf, foff) {
  let shirtId = 0;
  if (foff + 55 <= buf.length) {
    shirtId = buf.readUInt8(foff + 22);
  } else if (foff + 27 <= buf.length && buf.readUInt8(foff + 22) === 1) {
    shirtId = buf.readUInt32LE(foff + 23);
  } else if (foff + 26 <= buf.length) {
    shirtId = buf.readUInt32LE(foff + 22);
  }
  return shirtId > 0 && shirtId < 1000 ? shirtId : 0;
}

function safeBodyType(value) {
  return String(value || "male").toLowerCase() === "female" ? "female" : "male";
}

function safeBodyColors(value) {
  const input = Array.isArray(value) ? value : [];
  const out = [];
  for (let i = 0; i < 6; i += 1) {
    const color = String(input[i] || "#ffffff").trim();
    out.push(/^#?[0-9a-f]{6}$/i.test(color) ? (color.startsWith("#") ? color : `#${color}`) : "#ffffff");
  }
  return out;
}

function colorToPacketInt(color) {
  const match = String(color || "").match(/^#?([0-9a-f]{6})$/i);
  return match ? parseInt(match[1], 16) : 0xffffff;
}

function findNextRecord(buf, off, rec) {
  const minNext = off + rec.floatOffset + 22;
  const maxNext = Math.min(buf.length, off + rec.floatOffset + 96);
  for (let next = minNext; next <= maxNext; next++) {
    if (parseMovementRecord(buf, next, false)) return next;
  }
  return null;
}

function parseChatPacket(buf) {
  if (buf.length < 24 || buf.readUInt32LE(0) !== 2) return null;

  const playerId = readU64(buf, 4);
  const nameLen = readU64(buf, 12);
  if (playerId == null || !nameLen || nameLen > 64) return null;

  let off = 20;
  if (off + nameLen + 8 > buf.length) return null;
  const username = decoder.decode(buf.subarray(off, off + nameLen));
  if (!asciiOk(username)) return null;

  off += nameLen;
  const msgLen = readU64(buf, off);
  if (!msgLen || msgLen > 512) return null;

  off += 8;
  if (off + msgLen > buf.length) return null;
  const message = decoder.decode(buf.subarray(off, off + msgLen));
  if (!asciiOk(message)) return null;

  return { playerId, username, message };
}

function writeU64(buf, off, value) {
  buf.writeBigUInt64LE(BigInt(Math.max(0, Math.floor(Number(value) || 0))), off);
}

function readU64(buf, off) {
  if (off + 8 > buf.length) return null;
  const value = buf.readBigUInt64LE(off);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(value);
}

function safeInt(value) {
  const n = Number(value || 0);
  return Number.isInteger(n) && n >= 0 && n <= Number.MAX_SAFE_INTEGER ? n : 0;
}

function safeName(value) {
  return String(value || "BrowserPlayer").replace(/[^\x20-\x7e]/g, "").slice(0, 32) || "BrowserPlayer";
}

function asciiOk(text) {
  return !!text && [...text].every((c) => {
    const n = c.charCodeAt(0);
    return n >= 32 && n <= 126;
  });
}
