export const PROTOCOL_VERSION = 1;

export type ClientMessage =
  | { type: "hello"; protocolVersion: number; launchToken?: string; gameId?: number; lease?: unknown }
  | { type: "state"; x: number; y: number; z: number; ry: number; anim: string }
  | { type: "chat"; msg: string }
  | { type: "avatar_update"; avatar: unknown }
  | { type: "tool_action"; toolId: string; action: string; payload?: unknown }
  | { type: "heartbeat"; at: number };

export type ServerMessage =
  | { type: "init"; protocolVersion?: number; id: number; username: string; players: unknown[] }
  | { type: "join"; id: number; username: string; [key: string]: unknown }
  | { type: "leave"; id: number; username?: string }
  | { type: "states"; players: unknown[] }
  | { type: "kicked"; reason?: string }
  | { type: "kickbroad"; msg?: string }
  | { type: "system"; msg?: string }
  | { type: "system_red"; msg?: string }
  | { type: "chat_muted"; msg?: string }
  | { type: "chat_throttled"; msg?: string }
  | { type: "chat_blocked"; msg?: string }
  | { type: "player_join"; player: unknown }
  | { type: "player_leave"; id: number }
  | { type: "state"; id: number; x: number; y: number; z: number; ry: number; anim: string }
  | { type: "chat"; id: number; msg: string; username?: string; is_staff?: unknown; is_owner?: unknown; is_booster?: unknown }
  | { type: "avatar_update"; id: number; avatar: unknown }
  | { type: "script_package"; package: unknown }
  | { type: "error"; code: string; message: string }
  | { type: "heartbeat"; at: number };

export function isClientMessage(value: unknown): value is ClientMessage {
  return isMessage(value) && [
    "hello",
    "state",
    "chat",
    "avatar_update",
    "tool_action",
    "heartbeat"
  ].includes(value.type);
}

export function isServerMessage(value: unknown): value is ServerMessage {
  return isMessage(value) && [
    "init",
    "join",
    "leave",
    "states",
    "kicked",
    "kickbroad",
    "system",
    "system_red",
    "chat_muted",
    "chat_throttled",
    "chat_blocked",
    "player_join",
    "player_leave",
    "state",
    "chat",
    "avatar_update",
    "script_package",
    "error",
    "heartbeat"
  ].includes(value.type);
}

export function isCompatibleProtocolVersion(remoteVersion: unknown): boolean {
  return Number(remoteVersion || PROTOCOL_VERSION) === PROTOCOL_VERSION;
}

function isMessage(value: unknown): value is { type: string } {
  return Boolean(value && typeof value === "object" && typeof (value as Record<string, unknown>).type === "string");
}
