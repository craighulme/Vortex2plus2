import type { RuntimeApi } from "../../runtime/RuntimeApiExportService";

const BROADCAST_TICK_MS = 50;

type BroadcastBridgeContext = {
  window: Window;
  setInterval: Window["setInterval"];
  clearInterval: Window["clearInterval"];
  runtimeApi: Pick<RuntimeApi, "keys" | "getCharacter" | "getGrounded" | "getClimbState">;
  runtimeSession(): {
    startBroadcast(options: Record<string, unknown>): void;
    runBroadcastTick(options: Record<string, unknown>): void;
    stopBroadcast(clearIntervalRef: Window["clearInterval"]): void;
  };
  runtimeMultiplayer(): {
    buildLocalBroadcastState(options: Record<string, unknown>): unknown;
    shouldBroadcastLocalState(state: unknown): boolean;
    resetLocalBroadcast?(): void;
  };
  sceneYToNativeY(y: unknown): number;
  bridgeOpen(): boolean;
  encodeNetworkData(data: unknown): unknown;
  bridgeSend(payload: unknown): unknown;
};

export function createMultiplayerBroadcastBridge(context: BroadcastBridgeContext) {
  const {
    window,
    setInterval,
    clearInterval,
    runtimeApi,
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
          getCharacter: () => runtimeApi.getCharacter(),
          buildState: (char: NonNullable<ReturnType<RuntimeApi["getCharacter"]>>) => {
            const keys = runtimeApi.keys;
            const moving = keys["KeyW"] || keys["KeyS"] || keys["KeyA"] || keys["KeyD"] ||
              keys["ArrowUp"] || keys["ArrowDown"] || keys["ArrowLeft"] || keys["ArrowRight"];
            return runtimeMultiplayer().buildLocalBroadcastState({
              x: char.position.x ?? 0,
              y: char.position.y,
              z: char.position.z ?? 0,
              rotationY: char.rotation.y ?? 0,
              moving: !!moving,
              grounded: !!runtimeApi.getGrounded(),
              climbState: runtimeApi.getClimbState(),
              convertSceneYToNative: sceneYToNativeY
            });
          },
          shouldBroadcast: (state: unknown) => runtimeMultiplayer().shouldBroadcastLocalState(state),
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
