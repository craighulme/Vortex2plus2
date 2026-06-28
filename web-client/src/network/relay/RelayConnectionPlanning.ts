import { BrokeredRelaySocket } from "./BrokeredRelaySocket";
import type { BridgeConfig, LaunchIdentity } from "../../platform/PlatformBridge";

export type BridgeConnectionPlan = {
  blockedLocalRelay: boolean;
  localRelay: boolean;
  hostedRelay: boolean;
  brokeredRelay: boolean;
};

export type RelayHelloAvatar = {
  shirt_id: number;
  pant_id: number;
  body_type: string;
  body_colors: unknown[];
  face_id: number;
};

export type RelayHelloPayload = RelayHelloAvatar & {
  type: "hello";
  id: number;
  username: string;
  gameId: number;
  is_staff: false;
  is_booster: false;
  launchToken?: string;
  clientToken?: string;
  licenseLease?: unknown;
};

export function isLocalRelayUrl(value: unknown): boolean {
  try {
    const url = new URL(String(value || ""));
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function planBridgeConnection(config: Pick<BridgeConfig, "hubUrl" | "brokered" | "devLocalRelay">): BridgeConnectionPlan {
  const localRelayUrl = Boolean(config.hubUrl && isLocalRelayUrl(config.hubUrl));
  const blockedLocalRelay = Boolean(config.hubUrl && localRelayUrl && !config.devLocalRelay);
  const localRelay = Boolean(config.devLocalRelay && config.hubUrl && localRelayUrl);
  const hostedRelay = Boolean(config.hubUrl && !localRelay && !blockedLocalRelay);
  return {
    blockedLocalRelay,
    localRelay,
    hostedRelay,
    brokeredRelay: Boolean(hostedRelay && config.brokered !== false)
  };
}

export function buildHubUrl(config: Pick<BridgeConfig, "hubUrl" | "officialGameId">, launchInfo: Pick<LaunchIdentity, "gameId">, localRelay: boolean, fallbackGameId = 0): string {
  const hubUrl = new URL(config.hubUrl);
  if (!hubUrl.pathname || hubUrl.pathname === "/") hubUrl.pathname = "/ws";
  hubUrl.searchParams.set("game", String(localRelay ? (config.officialGameId || fallbackGameId || 0) : launchInfo.gameId));
  return hubUrl.toString();
}

export function createRelayHello(input: {
  launchInfo: LaunchIdentity;
  config: Pick<BridgeConfig, "officialGameId" | "launchToken" | "identity">;
  localRelay: boolean;
  brokeredRelay: boolean;
  fallbackGameId?: number;
  avatarOverride?: RelayHelloAvatar | null;
}): RelayHelloPayload {
  const avatar = input.avatarOverride || {
    shirt_id: input.launchInfo.shirtId || 0,
    pant_id: input.launchInfo.pantId || 0,
    body_type: input.launchInfo.bodyType || "male",
    body_colors: input.launchInfo.bodyColors || [],
    face_id: input.launchInfo.faceId || 0
  };
  const hello: RelayHelloPayload = {
    type: "hello",
    id: input.launchInfo.id || 0,
    username: input.launchInfo.username || "",
    gameId: input.localRelay ? Number(input.config.officialGameId || input.fallbackGameId || 0) : input.launchInfo.gameId,
    shirt_id: avatar.shirt_id,
    pant_id: avatar.pant_id,
    body_type: avatar.body_type,
    body_colors: avatar.body_colors,
    face_id: avatar.face_id,
    is_staff: false,
    is_booster: false
  };
  if (input.localRelay) {
    hello.launchToken = input.config.launchToken;
    hello.clientToken = input.launchInfo.clientToken || "";
  } else if (!input.brokeredRelay) {
    hello.launchToken = input.config.launchToken;
    hello.licenseLease = input.launchInfo.licenseLease || readIdentityLease(input.config.identity);
  }
  return hello;
}

export function isSocketOpen(socket: unknown): boolean {
  return Boolean(socket && typeof socket === "object" && (socket as { readyState?: unknown }).readyState === BrokeredRelaySocket.OPEN);
}

export function isSocketConnecting(socket: unknown): boolean {
  return Boolean(socket && typeof socket === "object" && (socket as { readyState?: unknown }).readyState === BrokeredRelaySocket.CONNECTING);
}

function readIdentityLease(identity: unknown): unknown {
  if (!identity || typeof identity !== "object") return null;
  const value = identity as Record<string, unknown>;
  return value.licenseLease || value.license_lease || value.lease || null;
}
