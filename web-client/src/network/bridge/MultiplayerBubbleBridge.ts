// @ts-nocheck

export function createMultiplayerBubbleBridge(context) {
  const {
    THREE,
    document,
    window,
    vortex,
    runtimeRemoteSession
  } = context;

  function service() {
    const bubbleService = window.VortexRuntime?.chatBubbles;
    if (!bubbleService) throw new Error("[mp] VortexRuntime chat bubble service is required.");
    return bubbleService.configure({ THREE, document, window, scene: vortex.scene });
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
    window.VortexRuntime?.chatBubbles?.clearPlayer?.(id);
  }

  function hasBubbles() {
    return !!window.VortexRuntime?.chatBubbles?.hasBubbles?.();
  }

  return {
    show,
    updatePositions,
    clear,
    hasBubbles
  };
}
