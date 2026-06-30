// @ts-nocheck

export function createMultiplayerRemoteAvatarBridge(context) {
  const {
    THREE,
    document,
    vortex,
    remotePlayers,
    animation
  } = context;

  function service() {
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
    animation?.animateRuntimeRemote?.(remote, dt);
  }

  return {
    service,
    make,
    setNameLabel,
    dispose,
    animate
  };
}
