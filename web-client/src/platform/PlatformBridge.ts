import type { AssetManifest } from "../assets/manifest";
import { normalizeAssetManifest } from "../assets/manifest";

export type BridgeConfig = {
  officialGameId: number;
  customGameId: string | null;
  launchToken: string;
  hubUrl: string;
  brokered: boolean;
  devLocalRelay: boolean;
  devFeatures: boolean;
  identity: unknown;
};

export type LaunchIdentity = {
  raw: unknown;
  id: number;
  username: string;
  gameId: number;
  shirtId: number;
  pantId: number;
  bodyType: string;
  bodyColors: unknown[];
  faceId: number;
  clientToken: string;
  requestedClientToken: string;
  wsEndpoint: string | null;
  licenseLease?: unknown;
  licenseFeatures?: unknown[];
};

const emptyBridgeConfig: BridgeConfig = {
  officialGameId: 0,
  customGameId: null,
  launchToken: "",
  hubUrl: "",
  brokered: false,
  devLocalRelay: false,
  devFeatures: false,
  identity: null
};

export class PlatformBridge {
  readonly assetManifest: AssetManifest;
  readonly bridgeConfig: BridgeConfig;

  constructor(document: Document, readonly location: Location) {
    this.assetManifest = normalizeAssetManifest(readMetaJson(document, "_importedAssets"));
    this.bridgeConfig = normalizeBridgeConfig(readMetaJson(document, "_vortexBridgeConfig"));
  }

  normalizeLaunchIdentity(raw: unknown, options: {
    defaultGameId?: number;
    requestedClientToken?: string;
    includeLease?: boolean;
    resolveWebSocket?: boolean;
  } = {}): LaunchIdentity | null {
    if (!raw || typeof raw !== "object") return null;
    const value = raw as Record<string, unknown>;
    const licenseLease = value.licenseLease || value.license_lease || value.lease || null;
    const info: LaunchIdentity = {
      raw,
      id: numField(raw, ["id", "user_id", "userId", "player_id", "playerId"], 0),
      username: strField(raw, ["username", "name", "display_name", "displayName"], "BrowserPlayer"),
      gameId: numField(raw, ["game_id", "gameId", "game"], Number(options.defaultGameId || 0)),
      shirtId: numField(raw, ["shirt_id", "shirtId", "clothing_id", "clothingId"], 0),
      pantId: numField(raw, ["pant_id", "pantId"], 0),
      bodyType: strField(raw, ["body_type", "bodyType"], "male"),
      bodyColors: Array.isArray(value.body_colors) ? value.body_colors : (Array.isArray(value.bodyColors) ? value.bodyColors : []),
      faceId: numField(raw, ["face_id", "faceId"], 0),
      clientToken: strField(raw, ["client_token", "clientToken"], ""),
      requestedClientToken: options.requestedClientToken || "",
      wsEndpoint: options.resolveWebSocket ? wsEndpoint(raw) : null
    };
    if (options.includeLease) {
      info.licenseLease = licenseLease;
      info.licenseFeatures = Array.isArray(value.licenseFeatures) ? value.licenseFeatures :
        (Array.isArray((licenseLease as { allowed_features?: unknown[] } | null)?.allowed_features) ? (licenseLease as { allowed_features: unknown[] }).allowed_features : []);
    }
    return info.id ? info : null;
  }

  createClientToken(cryptoRef: Pick<Crypto, "getRandomValues">, bytes = 32): string {
    const values = new Uint8Array(bytes);
    cryptoRef.getRandomValues(values);
    return [...values].map((value) => value.toString(16).padStart(2, "0")).join("");
  }

  async verifyLaunchToken(fetcher: typeof fetch, cryptoRef: Pick<Crypto, "getRandomValues">, config: Pick<BridgeConfig, "launchToken" | "officialGameId">): Promise<LaunchIdentity> {
    const requestedClientToken = this.createClientToken(cryptoRef);
    const response = await fetcher(`/api/verify-launch?token=${encodeURIComponent(config.launchToken)}`, {
      credentials: "include",
      cache: "no-store",
      headers: {
        "X-Client-Token": requestedClientToken
      }
    });
    if (!response.ok) {
      let detail = "";
      try {
        detail = await response.text();
      } catch {
        detail = "";
      }
      throw new Error(`verify-launch failed: HTTP ${response.status}${detail ? " " + detail : ""}`);
    }
    const raw = await response.json();
    const info = this.normalizeLaunchIdentity(raw, {
      defaultGameId: Number(config.officialGameId || 0),
      requestedClientToken,
      resolveWebSocket: true
    });
    if (!info) throw new Error("verify-launch response did not expose a player id");
    return info;
  }

  async resolveLaunchIdentity(fetcher: typeof fetch, cryptoRef: Pick<Crypto, "getRandomValues">, input: {
    config: BridgeConfig;
    localRelay: boolean;
    hostedRelay: boolean;
    current: LaunchIdentity | null;
    fallbackGameId?: number;
    onLocalFallback?(error: unknown): void;
  }): Promise<LaunchIdentity | null> {
    if (input.current) return input.current;
    try {
      if (input.localRelay || input.hostedRelay) {
        const identity = this.normalizeLaunchIdentity(input.config.identity, {
          defaultGameId: Number(input.config.officialGameId || input.fallbackGameId || 0),
          includeLease: true
        });
        if (identity) return identity;
      }
      if (!input.hostedRelay) return await this.verifyLaunchToken(fetcher, cryptoRef, input.config);
    } catch (error) {
      if (input.localRelay) {
        const identity = this.normalizeLaunchIdentity(input.config.identity, {
          defaultGameId: Number(input.config.officialGameId || input.fallbackGameId || 0),
          includeLease: true
        });
        if (identity) {
          input.onLocalFallback?.(error);
          return identity;
        }
      }
      throw error;
    }
    return null;
  }
}

function readMetaJson(document: Document, id: string): unknown {
  const raw = document.getElementById(id)?.getAttribute("content");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeBridgeConfig(raw: unknown): BridgeConfig {
  if (!raw || typeof raw !== "object") return emptyBridgeConfig;
  const value = raw as Record<string, unknown>;
  return {
    officialGameId: Number(value.officialGameId || 0),
    customGameId: typeof value.customGameId === "string" ? value.customGameId : null,
    launchToken: typeof value.launchToken === "string" ? value.launchToken : "",
    hubUrl: typeof value.hubUrl === "string" ? value.hubUrl : "",
    brokered: Boolean(value.brokered),
    devLocalRelay: Boolean(value.devLocalRelay),
    devFeatures: Boolean(value.devFeatures),
    identity: value.identity ?? null
  };
}

function findField(obj: unknown, names: string[]): unknown {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  const seen = new Set<unknown>();
  const stack: unknown[] = [obj];
  while (stack.length) {
    const current = stack.pop();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);
    for (const [key, value] of Object.entries(current as Record<string, unknown>)) {
      if (wanted.has(key.toLowerCase())) return value;
      if (value && typeof value === "object") stack.push(value);
    }
  }
  return undefined;
}

function numField(obj: unknown, names: string[], fallback = 0): number {
  const value = findField(obj, names);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return fallback;
}

function strField(obj: unknown, names: string[], fallback = ""): string {
  const value = findField(obj, names);
  return typeof value === "string" ? value : fallback;
}

function wsEndpoint(raw: unknown): string | null {
  const fields = [
    "websocket_url", "websocketUrl", "ws_url", "wsUrl", "socket_url", "socketUrl",
    "game_server", "gameServer", "server_addr", "serverAddr", "endpoint", "address"
  ];
  for (const name of fields) {
    const value = findField(raw, [name]);
    if (typeof value === "string" && /^wss?:\/\//i.test(value)) return value;
  }
  const host = strField(raw, ["ws_host", "wsHost", "websocket_host", "websocketHost"], "");
  const port = numField(raw, ["ws_port", "wsPort", "websocket_port", "websocketPort"], 0);
  if (host && port) return `wss://${host}:${port}`;
  return null;
}
