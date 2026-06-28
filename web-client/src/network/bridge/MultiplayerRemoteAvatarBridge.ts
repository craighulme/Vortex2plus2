// @ts-nocheck

export function createMultiplayerRemoteAvatarBridge(context) {
  const {
    THREE,
    document,
    window,
    vortex
  } = context;

  function service() {
    const remotePlayers = window.VortexRuntime?.remotePlayers;
    if (!remotePlayers) throw new Error("[mp] VortexRuntime remote player service is required.");
    return remotePlayers.configure({ THREE, document, vortex });
  }

  function make(username, id, avatar) {
    return service().makeRemote(username, id, avatar);
  }

  function setNameLabel(remote, username) {
    service().setNameLabel(remote, username);
  }

  function dispose(meshes) {
    service().disposeRemote(meshes);
  }

  function animate(id, remote, dt) {
    window.VortexRuntime?.animation?.animateLegacyRemote?.(remote, dt);
  }

  return {
    service,
    make,
    setNameLabel,
    dispose,
    animate
  };
}
