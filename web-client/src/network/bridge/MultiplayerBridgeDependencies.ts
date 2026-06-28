// @ts-nocheck

export type MultiplayerBridgeDependencies = {
  window: any;
  document: any;
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
  _vortex: any;
  scene: any;
};

export type MultiplayerBridgeDependencyResult =
  | { ok: true; deps: MultiplayerBridgeDependencies }
  | { ok: false; reason: string };

export function resolveMultiplayerBridgeDependencies(windowRef: Window, documentRef: Document): MultiplayerBridgeDependencyResult {
  const window = windowRef as any;
  const document = documentRef as any;
  const THREE = window.THREE;
  const Chat = window.Chat;
  const _vortex = window._vortex;

  if (!_vortex) return { ok: false, reason: "Vortex engine bridge is not ready" };
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
      _vortex,
      scene: _vortex?.scene
    }
  };
}
