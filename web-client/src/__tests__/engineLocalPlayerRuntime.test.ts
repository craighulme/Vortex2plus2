import { describe, expect, it, vi } from "vitest";
import { EngineLocalPlayerRuntimeService } from "../movement/EngineLocalPlayerRuntimeService";

describe("EngineLocalPlayerRuntimeService", () => {
  it("configures local movement with runtime-owned dependencies", () => {
    const configure = vi.fn((config) => ({ config, resetCharacterToSpawn: () => true }));
    const runtime = {
      localMovement: { configure },
      movement: "movement",
      characterCollision: "collision",
      climb: "climb",
      animation: "animation",
      physics: "physics",
      camera: { state: "camera-state" },
      cursor: "cursor",
      settingsStore: "settings",
      input: { keys: { Space: true } }
    };

    const handles = new EngineLocalPlayerRuntimeService().configure({
      THREE: { Vector3: class Vector3 {} },
      runtime,
      cameraObject: "camera-object",
      animationState: "anim",
      characterSpawn: "spawn",
      localAvatar: "avatar",
      windowRef: {} as Window,
      getCharacter: () => "character",
      getNearbyColliders: () => new Set(),
      getMetrics: () => ({ height: 5 }),
      setMouseLock: vi.fn(),
      setFirstPerson: vi.fn()
    });

    expect(handles.cameraState).toBe("camera-state");
    expect(handles.localMovement.resetCharacterToSpawn()).toBe(true);
    expect(configure).toHaveBeenCalledOnce();
    expect(configure.mock.calls[0]?.[0]).toMatchObject({
      movement: "movement",
      collision: "collision",
      climb: "climb",
      animation: "animation",
      physics: "physics",
      camera: runtime.camera,
      cursor: "cursor",
      localAvatar: "avatar",
      settingsStore: "settings",
      keys: { Space: true },
      cameraObject: "camera-object",
      anim: "anim",
      characterSpawn: "spawn"
    });
  });
});
