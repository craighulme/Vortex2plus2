import type { ServerMessage } from "./schemas";

export type NativeLaunchInfo = {
  id: number;
  gameId: number;
  username: string;
  bodyColors?: unknown[];
  bodyType?: unknown;
  shirtId?: unknown;
  pantId?: unknown;
  faceId?: unknown;
  clientToken?: unknown;
};

export type NativeMovementInput = {
  x?: unknown;
  y?: unknown;
  z?: unknown;
  ry?: unknown;
  anim?: unknown;
};

export type NativePlayerRecord = {
  id: number;
  game: number;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  state0: number;
  state1: number;
  animTime: number;
  roleFlags: number;
  shirtId: number;
  pantId: number;
  bodyType: "male" | "female";
  bodyColors: string[];
  faceId: number;
  hasAvatar: boolean;
  valid: boolean;
  floatOffset: number;
  recordBytes: number;
};

export type NativePlayerState = {
  id: number;
  username: string;
  is_staff: false;
  is_booster: false;
  x: number;
  y: number;
  z: number;
  ry: number;
  anim: "idle" | "walk" | "jump";
  role_flags?: number;
  shirt_id?: number;
  pant_id?: number;
  body_type?: "male" | "female";
  body_colors?: string[];
  face_id?: number;
};

export type NativeChatPacket = {
  playerId: number;
  username: string;
  message: string;
};

export type NativeSystemPacket = {
  message: string;
};

export type ClassifiedSystemMessage =
  | { type: "chat_throttled"; wait: number | "a moment" }
  | { type: "chat_blocked"; msg: string }
  | { type: "system_red"; msg: string }
  | { type: "system"; msg: string };

export function nativePacketMessages(buffer: ArrayBuffer, options: { selfId: unknown; hasRemote(id: unknown): boolean }): ServerMessage[] {
  const players = parsePlayersPacket(buffer);
  if (players) {
    const converted = convertNativePlayers(players, options.selfId);
    const joins = converted
      .filter((player) => !options.hasRemote(player.id))
      .map((player) => ({ type: "join" as const, ...player }));
    return [...joins, { type: "states", players: converted }];
  }
  const chat = parseChatPacket(buffer);
  if (chat) {
    return [{
      type: "chat",
      id: chat.playerId,
      username: chat.username,
      msg: chat.message,
      is_staff: false,
      is_owner: false,
      is_booster: false
    }];
  }
  const notice = parseSystemPacket(buffer);
  return notice ? [classifySystemMessage(notice.message)] : [];
}

export function parsePlayersPacket(buffer: ArrayBuffer): NativePlayerRecord[] | null {
  const view = new DataView(buffer);
  if (readU32(view, 0) !== 1) return null;
  const expected = readU64(view, 4);
  if (expected == null) return null;
  const records: NativePlayerRecord[] = [];
  const seen = new Set<number>();
  let offset = 12;
  while (offset + 32 < buffer.byteLength && records.length < 128 && (!expected || records.length < expected)) {
    const record = parseMovementRecord(buffer, offset, false);
    if (!record) {
      offset += 1;
      continue;
    }
    if (!seen.has(record.id)) {
      seen.add(record.id);
      records.push(record);
    }
    const next = findNextRecord(buffer, offset, record);
    offset = next == null ? offset + 1 : next;
  }
  return records;
}

export function parseChatPacket(buffer: ArrayBuffer): NativeChatPacket | null {
  const view = new DataView(buffer);
  if (readU32(view, 0) !== 2) return null;
  const playerId = readU64(view, 4);
  const nameLen = readU64(view, 12);
  if (playerId == null || !nameLen || nameLen > 64) return null;
  let offset = 20;
  if (offset + nameLen + 8 > buffer.byteLength) return null;
  const username = new TextDecoder().decode(new Uint8Array(buffer, offset, nameLen));
  if (!textOk(username)) return null;
  offset += nameLen;
  const msgLen = readU64(view, offset);
  if (!msgLen || msgLen > 512) return null;
  offset += 8;
  if (offset + msgLen > buffer.byteLength) return null;
  const message = new TextDecoder().decode(new Uint8Array(buffer, offset, msgLen));
  if (!textOk(message)) return null;
  return { playerId, username, message };
}

export function parseSystemPacket(buffer: ArrayBuffer): NativeSystemPacket | null {
  const view = new DataView(buffer);
  if (readU32(view, 0) !== 5) return null;
  const msgLen = readU64(view, 4);
  if (!msgLen || msgLen > 1024 || 12 + msgLen > buffer.byteLength) return null;
  const message = new TextDecoder().decode(new Uint8Array(buffer, 12, msgLen));
  return textOk(message) ? { message } : null;
}

export function classifySystemMessage(message: unknown): ClassifiedSystemMessage {
  const text = String(message || "");
  if (/wait|slow down|too fast|rate limit|throttle/i.test(text)) {
    const wait = Number(text.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|second)/i)?.[1] || 0);
    return { type: "chat_throttled", wait: wait || "a moment" };
  }
  if (/blocked|filtered|not allowed|inappropriate|moderation/i.test(text)) {
    return { type: "chat_blocked", msg: text };
  }
  if (/kick|ban|disconnect|already playing|another window/i.test(text)) {
    return { type: "system_red", msg: text };
  }
  return { type: "system", msg: text };
}

export function convertNativePlayers(players: NativePlayerRecord[], selfId: unknown): NativePlayerState[] {
  const localId = Number(selfId || 0);
  return players.filter((player) => player.id !== localId).map((player) => {
    const state: NativePlayerState = {
      id: player.id,
      username: player.name,
      is_staff: false,
      is_booster: false,
      x: player.x,
      y: player.y,
      z: player.z,
      ry: player.yaw,
      anim: player.state1 === 0 ? "jump" : player.state0 ? "walk" : "idle"
    };
    if (player.roleFlags) state.role_flags = player.roleFlags;
    if (player.hasAvatar) {
      if (player.shirtId) state.shirt_id = player.shirtId;
      if (player.pantId) state.pant_id = player.pantId;
      if (player.bodyType) state.body_type = player.bodyType;
      if (Array.isArray(player.bodyColors) && player.bodyColors.length === 6) state.body_colors = player.bodyColors;
      if (player.faceId) state.face_id = player.faceId;
    }
    return state;
  });
}

function parseMovementRecord(buffer: ArrayBuffer, offset: number, hasPacketType: boolean): NativePlayerRecord | null {
  const view = new DataView(buffer, offset);
  const start = hasPacketType ? 4 : 0;
  if (view.byteLength < start + 34) return null;
  const id = readU64(view, start);
  const game = readU64(view, start + 8);
  const nameLen = readU64(view, start + 16);
  if (id == null || game == null || !nameLen || nameLen > 64) return null;
  const nameOff = start + 24;
  if (nameOff + nameLen > view.byteLength) return null;
  const bytes = new Uint8Array(buffer, offset + nameOff, nameLen);
  const name = new TextDecoder().decode(bytes);
  if (!textOk(name)) return null;

  const foffNoNul = nameOff + nameLen;
  const offsets = [foffNoNul, foffNoNul + 1, foffNoNul + 2];
  let best: { record: NativePlayerRecord; score: number } | null = null;
  for (const foff of offsets) {
    if (foff + 18 > view.byteLength) continue;
    const x = view.getFloat32(foff, true);
    const y = view.getFloat32(foff + 4, true);
    const z = view.getFloat32(foff + 8, true);
    const yaw = view.getFloat32(foff + 12, true);
    if (![x, y, z, yaw].every(Number.isFinite)) continue;
    if (Math.abs(x) > 1000000 || Math.abs(y) > 1000000 || Math.abs(z) > 1000000) continue;
    const parsedAvatar = readPacketAvatar(view, foff);
    const avatar = parsedAvatar.recordBytes && !parsedAvatar.valid ? {
      shirtId: 0,
      pantId: 0,
      bodyType: "male" as const,
      bodyColors: [],
      faceId: 0,
      hasAvatar: false,
      valid: true,
      recordBytes: parsedAvatar.recordBytes
    } : parsedAvatar;
    const record: NativePlayerRecord = {
      id,
      game,
      name,
      x,
      y,
      z,
      yaw,
      state0: view.getUint8(foff + 16),
      state1: view.getUint8(foff + 17),
      animTime: foff + 22 <= view.byteLength ? view.getFloat32(foff + 18, true) : 0,
      roleFlags: foff > foffNoNul ? view.getUint8(foffNoNul) : 0,
      ...avatar,
      floatOffset: foff,
      recordBytes: avatar.recordBytes || 22
    };
    let score = 0;
    if (record.state0 <= 1 && record.state1 <= 1) score += 100;
    if (Math.abs(record.yaw) <= 8) score += 20;
    if (foff === foffNoNul + 1 && view.getUint8(foffNoNul) === 0) score += 10;
    else if (foff === foffNoNul + 1 && view.getUint8(foffNoNul) <= 0x0f) score += 12;
    else if (foff === foffNoNul) score += 8;
    else if (foff === foffNoNul + 1) score += 2;
    if (!best || score > best.score) best = { record, score };
  }
  return best?.record || null;
}

function readPacketAvatar(view: DataView, foff: number): Omit<NativePlayerRecord, "id" | "game" | "name" | "x" | "y" | "z" | "yaw" | "state0" | "state1" | "animTime" | "roleFlags" | "floatOffset"> {
  const avatar = {
    shirtId: 0,
    pantId: 0,
    bodyType: "male" as "male" | "female",
    bodyColors: [] as string[],
    faceId: 0,
    hasAvatar: false,
    valid: true,
    recordBytes: 0
  };
  const legacyBodyType = foff + 63 <= view.byteLength ? view.getUint8(foff + 27) : 0;
  if (foff + 59 <= view.byteLength && view.getUint8(foff + 22) === 1 && legacyBodyType !== 1 && legacyBodyType !== 2) {
    avatar.shirtId = view.getUint32(foff + 23, true);
    const colors: string[] = [];
    let off = foff + 29;
    for (let i = 0; i < 6; i += 1) {
      colors.push(packetColorHex(view.getUint32(off, true)));
      off += 4;
    }
    avatar.bodyColors = colors;
    const bodyTypeByte = view.getUint8(off);
    avatar.bodyType = bodyTypeByte === 2 ? "female" : "male";
    avatar.faceId = view.getUint32(off + 1, true);
    avatar.valid = (bodyTypeByte === 1 || bodyTypeByte === 2) && avatar.shirtId >= 0 && avatar.shirtId < 1000 && avatar.faceId >= 0 && avatar.faceId < 1000;
    avatar.hasAvatar = avatar.valid;
    avatar.recordBytes = 59;
  } else {
    readCurrentAvatarRecord(view, foff, avatar);
  }
  if (avatar.shirtId < 0 || avatar.shirtId >= 1000) avatar.shirtId = 0;
  if (avatar.pantId < 0 || avatar.pantId >= 1000) avatar.pantId = 0;
  if (avatar.faceId < 0 || avatar.faceId >= 1000) avatar.faceId = 0;
  return avatar;
}

function readCurrentAvatarRecord(view: DataView, foff: number, avatar: ReturnType<typeof baseAvatarRecord>): void {
  const compactBodyType = foff + 55 <= view.byteLength ? view.getUint8(foff + 49) : 0;
  if (foff + 55 <= view.byteLength && view.getUint8(foff + 24) === 0 && (compactBodyType === 1 || compactBodyType === 2)) {
    avatar.shirtId = view.getUint8(foff + 22);
    avatar.pantId = view.getUint8(foff + 23);
    fillCompactAvatar(view, foff + 25, compactBodyType, avatar);
    avatar.recordBytes = 55;
  } else if (foff + 63 <= view.byteLength && view.getUint8(foff + 22) === 1) {
    avatar.shirtId = view.getUint32(foff + 23, true);
    avatar.pantId = view.getUint32(foff + 28, true);
    fillCompactAvatar(view, foff + 33, view.getUint8(foff + 57), avatar);
    avatar.recordBytes = 63;
  } else if (foff + 55 <= view.byteLength) {
    avatar.shirtId = view.getUint8(foff + 22);
    avatar.pantId = view.getUint8(foff + 23);
    fillCompactAvatar(view, foff + 25, view.getUint8(foff + 49), avatar);
    avatar.recordBytes = 55;
  } else if (foff + 27 <= view.byteLength && view.getUint8(foff + 22) === 1) {
    avatar.faceId = view.getUint32(foff + 23, true);
  } else if (foff + 26 <= view.byteLength) {
    avatar.shirtId = view.getUint32(foff + 22, true);
  }
}

function fillCompactAvatar(view: DataView, colorOffset: number, bodyTypeByte: number, avatar: ReturnType<typeof baseAvatarRecord>): void {
  const colors: string[] = [];
  let off = colorOffset;
  for (let i = 0; i < 6; i += 1) {
    colors.push(packetColorHex(view.getUint32(off, true)));
    off += 4;
  }
  avatar.bodyColors = colors;
  avatar.bodyType = bodyTypeByte === 2 ? "female" : "male";
  avatar.faceId = view.getUint32(off + 1, true);
  avatar.valid = (bodyTypeByte === 1 || bodyTypeByte === 2) && avatar.shirtId >= 0 && avatar.shirtId < 1000 && avatar.pantId >= 0 && avatar.pantId < 1000 && avatar.faceId >= 0 && avatar.faceId < 1000;
  avatar.hasAvatar = avatar.valid;
}

function baseAvatarRecord() {
  return {
    shirtId: 0,
    pantId: 0,
    bodyType: "male" as "male" | "female",
    bodyColors: [] as string[],
    faceId: 0,
    hasAvatar: false,
    valid: true,
    recordBytes: 0
  };
}

function findNextRecord(buffer: ArrayBuffer, offset: number, record: NativePlayerRecord): number | null {
  const minNext = offset + record.floatOffset + (record.recordBytes || 22);
  const maxNext = Math.min(buffer.byteLength, offset + record.floatOffset + 96);
  for (let next = minNext; next <= maxNext; next += 1) {
    if (parseMovementRecord(buffer, next, false)) return next;
  }
  return null;
}

function packetColorHex(value: unknown): string {
  return `#${(Number(value || 0) & 0xffffff).toString(16).padStart(6, "0")}`;
}

function readU64(view: DataView, offset: number): number | null {
  if (offset + 8 > view.byteLength) return null;
  const value = view.getBigUint64(offset, true);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return Number(value);
}

function readU32(view: DataView, offset: number): number | null {
  return offset + 4 <= view.byteLength ? view.getUint32(offset, true) : null;
}

function textOk(text: string): boolean {
  return Boolean(text) && [...text].every((char) => {
    const code = char.codePointAt(0);
    return code === 9 || code === 10 || code === 13 || (Number(code) >= 32 && code !== 0x7f);
  });
}
