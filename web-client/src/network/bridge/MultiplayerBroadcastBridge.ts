// @ts-nocheck

const BROADCAST_TICK_MS = 50;

export function createMultiplayerBroadcastBridge(context) {
  const {
    window,
    setInterval,
    clearInterval,
    vortex,
    runtimeSession,
    runtimeMultiplayer,
    sceneYToNativeY,
    bridgeOpen,
    encodeNetworkData,
    bridgeSend
  } = context;

  function start() {
    runtimeSession().startBroadcast({
      setInterval,
      intervalMs: BROADCAST_TICK_MS,
      tick: () => {
        runtimeSession().runBroadcastTick({
          isOpen: bridgeOpen,
          getCharacter: () => vortex.getCharacter(),
          buildState: (char) => {
            const keys = vortex.keys;
            const moving = keys["KeyW"] || keys["KeyS"] || keys["KeyA"] || keys["KeyD"] ||
              keys["ArrowUp"] || keys["ArrowDown"] || keys["ArrowLeft"] || keys["ArrowRight"];
            return runtimeMultiplayer().buildLocalBroadcastState({
              x: char.position.x,
              y: char.position.y,
              z: char.position.z,
              rotationY: char.rotation.y,
              moving: !!moving,
              grounded: !!vortex.getGrounded(),
              climbState: vortex.getClimbState(),
              convertSceneYToNative: sceneYToNativeY
            });
          },
          shouldBroadcast: (state) => runtimeMultiplayer().shouldBroadcastLocalState(state),
          encode: encodeNetworkData,
          send: bridgeSend
        });
      }
    });
  }

  function stop() {
    runtimeSession().stopBroadcast(clearInterval);
    runtimeMultiplayer().resetLocalBroadcast?.();
  }

  return { start, stop };
}
