// @ts-nocheck

export function createMultiplayerBubbleBridge(context) {
  const {
    THREE,
    document,
    window,
    vortex,
    chatBubbles,
    runtimeRemoteSession
  } = context;

  function service() {
    if (!chatBubbles) throw new Error("[mp] VortexRuntime chat bubble service is required.");
    return chatBubbles.configure({ THREE, document, window, scene: vortex.scene });
  }

  function show(id, text) {
    service().show(id, text);
  }

  function updatePositions(selfId) {
    service().updatePositions({
      selfId,
      selfAnchor: vortex.getCharacter(),
      selfBubbleBaseY: vortex.getCharBubbleBase(),
      remoteBubbleBaseOffset: vortex.getCharHeight() - vortex.getCharFootOffset() + 0.4,
      getRemoteAnchor: (id) => runtimeRemoteSession().get(id)?.meshes?.grp || null,
    });
  }

  function clear(id) {
    chatBubbles?.clearPlayer?.(id);
  }

  function hasBubbles() {
    return !!chatBubbles?.hasBubbles?.();
  }

  return {
    show,
    updatePositions,
    clear,
    hasBubbles
  };
}
