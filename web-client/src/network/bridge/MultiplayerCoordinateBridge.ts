// @ts-nocheck

export function createMultiplayerCoordinateBridge({ vortex, runtimeMultiplayer }) {
  function nativeFootOffset() {
    const sceneOffset = Number(vortex.getCharFootOffset?.());
    return runtimeMultiplayer().nativeFootOffset(Number.isFinite(sceneOffset) ? sceneOffset : undefined);
  }

  function sceneFootOffset() {
    const offset = Number(vortex.getCharFootOffset?.());
    return Number.isFinite(offset) ? offset : nativeFootOffset();
  }

  function nativeYToSceneY(y) {
    return runtimeMultiplayer().nativeYToSceneY(y, nativeFootOffset(), sceneFootOffset());
  }

  function sceneYToNativeY(y) {
    return runtimeMultiplayer().sceneYToNativeY(y, nativeFootOffset(), sceneFootOffset());
  }

  return {
    nativeFootOffset,
    sceneFootOffset,
    nativeYToSceneY,
    sceneYToNativeY
  };
}
