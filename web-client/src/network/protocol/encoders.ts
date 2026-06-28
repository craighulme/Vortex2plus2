import { DEFAULT_BODY_COLORS } from "../../avatar/AvatarService";
import type { NativeLaunchInfo, NativeMovementInput } from "./nativePackets";

export function encodeMovementPacket(data: NativeMovementInput, launchInfo: NativeLaunchInfo, animClock: number): { buffer: ArrayBuffer; animClock: number } {
  const nameBytes = new TextEncoder().encode(launchInfo.username);
  const length = 4 + 8 + 8 + 8 + nameBytes.length + 1 + 16 + 2 + 4 + 34;
  const buffer = new ArrayBuffer(length);
  const view = new DataView(buffer);
  let offset = 0;
  view.setUint32(offset, 0, true); offset += 4;
  writeU64(view, offset, launchInfo.id); offset += 8;
  writeU64(view, offset, launchInfo.gameId); offset += 8;
  writeU64(view, offset, nameBytes.length); offset += 8;
  new Uint8Array(buffer, offset, nameBytes.length).set(nameBytes); offset += nameBytes.length;
  view.setUint8(offset, 0); offset += 1;
  view.setFloat32(offset, Number(data.x || 0), true); offset += 4;
  view.setFloat32(offset, Number(data.y || 0), true); offset += 4;
  view.setFloat32(offset, Number(data.z || 0), true); offset += 4;
  view.setFloat32(offset, Number(data.ry || 0), true); offset += 4;
  const anim = String(data.anim || "idle");
  view.setUint8(offset, anim === "idle" ? 0 : 1); offset += 1;
  view.setUint8(offset, anim === "jump" ? 0 : 1); offset += 1;
  const nextAnimClock = animClock + 0.05;
  view.setFloat32(offset, nextAnimClock, true); offset += 4;
  const colors = safeBodyColors(launchInfo.bodyColors);
  const bodyType = String(launchInfo.bodyType || "male").toLowerCase() === "female" ? 2 : 1;
  const shirtId = Number(launchInfo.shirtId || 0) || 0;
  const faceId = Number(launchInfo.faceId || 0) || 0;
  view.setUint8(offset, Math.max(0, Math.min(255, shirtId))); offset += 1;
  view.setUint8(offset, Math.max(0, Math.min(255, Number(launchInfo.pantId || 0) || 0))); offset += 1;
  view.setUint8(offset, 0); offset += 1;
  view.setUint8(offset, 0); offset += 1;
  for (let i = 0; i < 6; i += 1) {
    view.setUint32(offset, packetColorInt(colors[i]), true);
    offset += 4;
  }
  view.setUint8(offset, bodyType); offset += 1;
  view.setUint32(offset, faceId, true); offset += 4;
  view.setUint8(offset, 0);
  return { buffer, animClock: nextAnimClock };
}

export function encodeHeartbeat(launchInfo: Pick<NativeLaunchInfo, "clientToken">): ArrayBuffer {
  const token = String(launchInfo.clientToken || "").slice(0, 64);
  const bytes = new TextEncoder().encode(token);
  const buffer = new ArrayBuffer(12 + bytes.length);
  const view = new DataView(buffer);
  view.setUint32(0, 6, true);
  writeU64(view, 4, bytes.length);
  new Uint8Array(buffer, 12, bytes.length).set(bytes);
  return buffer;
}

export function encodeChatPacket(message: unknown, launchInfo: Pick<NativeLaunchInfo, "id" | "username">): ArrayBuffer {
  const name = new TextEncoder().encode(launchInfo.username);
  const text = new TextEncoder().encode(String(message || "").slice(0, 512));
  const buffer = new ArrayBuffer(4 + 8 + 8 + name.length + 8 + text.length + 1);
  const view = new DataView(buffer);
  let offset = 0;
  view.setUint32(offset, 2, true); offset += 4;
  writeU64(view, offset, launchInfo.id); offset += 8;
  writeU64(view, offset, name.length); offset += 8;
  new Uint8Array(buffer, offset, name.length).set(name); offset += name.length;
  writeU64(view, offset, text.length); offset += 8;
  new Uint8Array(buffer, offset, text.length).set(text); offset += text.length;
  view.setUint8(offset, 0);
  return buffer;
}

function writeU64(view: DataView, offset: number, value: unknown): void {
  view.setBigUint64(offset, BigInt(Math.max(0, Math.floor(Number(value) || 0))), true);
}

function safeBodyColors(value: unknown): string[] {
  const input = Array.isArray(value) ? value : [];
  const out: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const fallback = DEFAULT_BODY_COLORS[i] || "#ffffff";
    const color = String(input[i] || fallback).trim();
    out.push(/^#?[0-9a-f]{6}$/i.test(color) ? (color.startsWith("#") ? color : `#${color}`) : fallback);
  }
  return out;
}

function packetColorInt(color: unknown): number {
  const match = String(color || "").match(/^#?([0-9a-f]{6})$/i);
  return match?.[1] ? parseInt(match[1], 16) : 0xffffff;
}
