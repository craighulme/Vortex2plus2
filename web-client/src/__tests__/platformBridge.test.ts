import { describe, expect, it } from "vitest";
import { PlatformBridge } from "../platform/PlatformBridge";

describe("PlatformBridge", () => {
  it("normalizes extension bridge config from meta", () => {
    const documentLike = {
      getElementById(id: string) {
        const content = id === "_vortexBridgeConfig"
          ? JSON.stringify({
            officialGameId: 3,
            customGameId: null,
            launchToken: "token",
            hubUrl: "wss://relay.example/ws",
            brokered: true,
            devLocalRelay: true,
            devFeatures: true,
            identity: { userId: 18154 }
          })
          : "{}";
        return { getAttribute: () => content };
      }
    } as unknown as Document;

    const bridge = new PlatformBridge(documentLike, { href: "https://playvortex.io/games/3" } as Location);

    expect(bridge.bridgeConfig).toEqual({
      officialGameId: 3,
      customGameId: null,
      launchToken: "token",
      hubUrl: "wss://relay.example/ws",
      brokered: true,
      devLocalRelay: true,
      devFeatures: true,
      identity: { userId: 18154 }
    });
  });

  it("normalizes nested launch identity responses", () => {
    const documentLike = {
      getElementById() {
        return { getAttribute: () => "{}" };
      }
    } as unknown as Document;
    const bridge = new PlatformBridge(documentLike, { href: "https://playvortex.io/games/3" } as Location);

    expect(bridge.normalizeLaunchIdentity({
      profile: { player_id: "18154", displayName: "monsterenergy" },
      avatar: { shirt_id: 8 },
      websocket_host: "relay.example",
      websocket_port: "443",
      license_lease: { allowed_features: ["packet-debug"] }
    }, {
      defaultGameId: 3,
      requestedClientToken: "client-token",
      resolveWebSocket: true,
      includeLease: true
    })).toMatchObject({
      id: 18154,
      username: "monsterenergy",
      gameId: 3,
      shirtId: 8,
      requestedClientToken: "client-token",
      wsEndpoint: "wss://relay.example:443",
      licenseFeatures: ["packet-debug"]
    });
  });

  it("verifies launch tokens through the platform bridge", async () => {
    const documentLike = {
      getElementById() {
        return { getAttribute: () => "{}" };
      }
    } as unknown as Document;
    const bridge = new PlatformBridge(documentLike, { href: "https://playvortex.io/games/3" } as Location);
    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetcher = (async (url: string, init?: RequestInit) => {
      requests.push({ url, init });
      return {
        ok: true,
        json: async () => ({ user_id: 18154, username: "monsterenergy", game_id: 3 })
      } as Response;
    }) as typeof fetch;
    const cryptoRef = {
      getRandomValues<T extends ArrayBufferView>(values: T): T {
        new Uint8Array(values.buffer, values.byteOffset, values.byteLength).fill(2);
        return values;
      }
    };

    await expect(bridge.verifyLaunchToken(fetcher, cryptoRef, {
      launchToken: "abc 123",
      officialGameId: 3
    })).resolves.toMatchObject({
      id: 18154,
      username: "monsterenergy",
      requestedClientToken: "02".repeat(32)
    });

    expect(requests[0]?.url).toBe("/api/verify-launch?token=abc%20123");
    expect(requests[0]?.init?.headers).toEqual({ "X-Client-Token": "02".repeat(32) });
  });

  it("resolves hosted/local relay launch identity from bridge config", async () => {
    const documentLike = {
      getElementById() {
        return { getAttribute: () => "{}" };
      }
    } as unknown as Document;
    const bridge = new PlatformBridge(documentLike, { href: "https://playvortex.io/games/3" } as Location);
    const fetcher = (async () => {
      throw new Error("fetch should not be used for hosted identity");
    }) as typeof fetch;

    await expect(bridge.resolveLaunchIdentity(fetcher, cryptoRef(), {
      config: {
        officialGameId: 3,
        customGameId: null,
        launchToken: "",
        hubUrl: "wss://relay.example/ws",
        brokered: true,
        devLocalRelay: false,
        devFeatures: false,
        identity: { user_id: 18154, username: "monsterenergy", licenseLease: { allowed_features: ["packet-debug"] } }
      },
      localRelay: false,
      hostedRelay: true,
      current: null
    })).resolves.toMatchObject({
      id: 18154,
      username: "monsterenergy",
      licenseFeatures: ["packet-debug"]
    });
  });
});

function cryptoRef(): Pick<Crypto, "getRandomValues"> {
  return {
    getRandomValues<T extends ArrayBufferView>(values: T): T {
      new Uint8Array(values.buffer, values.byteOffset, values.byteLength).fill(2);
      return values;
    }
  };
}
