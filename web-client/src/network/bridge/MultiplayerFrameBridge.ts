// @ts-nocheck

export function installMultiplayerFrameBridge(context) {
  const {
    window,
    vortex,
    runtimeRemoteSession,
    remotePlayerService,
    normalizeAvatarFields,
    playerDisplayName,
    noteRemoteState,
    animateRemote,
    hasBubbles,
    updateBubblePositions,
    bridgeSend,
    shouldSkipAvatarRebuild,
    clearSkipAvatarRebuild
  } = context;

  window._mpUpdate = function (dt) {
    const remoteSession = runtimeRemoteSession();
    if (remoteSession.pendingAvatars.size === 0 && remoteSession.remotes.size === 0 && !hasBubbles()) return;

    const cam = vortex.getCamera?.();
    remoteSession.updateFrame({
      service: remotePlayerService(),
      dt,
      now: performance.now(),
      shouldAnimate: !!cam?.position,
      normalizeAvatar: normalizeAvatarFields,
      displayName: playerDisplayName,
      noteState: (remote, status, reason) => noteRemoteState(remote, status, reason),
      animate: animateRemote,
      onCreateError: (error) => console.error("[mp] makeRemote failed:", error),
      cameraPosition: cam?.position || null,
    });

    updateBubblePositions();
  };

  window._mpSendChat = function (msg) {
    bridgeSend({ type: "chat", msg });
  };

  window.addEventListener("vweb-character-renderer-changed", () => {
    if (shouldSkipAvatarRebuild()) {
      clearSkipAvatarRebuild();
      return;
    }
    window._mpRebuildAvatars?.();
  });
}
