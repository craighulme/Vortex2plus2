import type { RuntimeApi } from "../../runtime/RuntimeApiExportService";

export type MultiplayerBridgeDependencies = {
  window: Window & {
    VortexRuntime?: any;
    Chat?: any;
    WebSocket: typeof WebSocket;
    GAME_ID?: unknown;
    _mpSetFriendStatus?: (id: unknown, status: unknown) => void;
  };
  document: Document;
  localStorage: Storage;
  setTimeout: Window["setTimeout"];
  setInterval: Window["setInterval"];
  clearInterval: Window["clearInterval"];
  fetch: typeof fetch;
  crypto: Crypto;
  WebSocket: typeof WebSocket;
  location: Location;
  THREE: any;
  Chat: any;
  runtimeApi: RuntimeApi;
  scene: any;
};

export type MultiplayerBridgeDependencyResult =
  | { ok: true; deps: MultiplayerBridgeDependencies }
  | { ok: false; reason: string };

export function resolveMultiplayerBridgeDependencies(windowRef: Window, documentRef: Document, runtimeApi: RuntimeApi | null): MultiplayerBridgeDependencyResult {
  const window = windowRef as MultiplayerBridgeDependencies["window"];
  const document = documentRef;
  const THREE = window.VortexRuntime?.renderer?.getHandles?.()?.three;
  const Chat = window.Chat;
  const api = runtimeApi;

  if (!api) return { ok: false, reason: "runtime exports are not ready" };
  if (!THREE) return { ok: false, reason: "THREE is not ready" };
  if (!Chat) return { ok: false, reason: "chat service is not ready" };

  return {
    ok: true,
    deps: {
      window,
      document,
      localStorage: window.localStorage,
      setTimeout: window.setTimeout.bind(window),
      setInterval: window.setInterval.bind(window),
      clearInterval: window.clearInterval.bind(window),
      fetch: window.fetch.bind(window),
      crypto: window.crypto,
      WebSocket: window.WebSocket,
      location: window.location,
      THREE,
      Chat,
      runtimeApi: api,
      scene: api?.scene
    }
  };
}
