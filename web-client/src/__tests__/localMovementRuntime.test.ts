import { describe, expect, it } from "vitest";
import { AnimationService } from "../animation/AnimationService";
import { CameraService } from "../camera/CameraService";
import { LocalMovementRuntimeService } from "../movement/LocalMovementRuntimeService";
import { MovementService } from "../movement/MovementService";

describe("LocalMovementRuntimeService", () => {
  it("resets vertical state when movement mods require it and resets the character to spawn", () => {
    const movement = new MovementService();
    const character = {
      position: { x: 10, y: 20, z: 30, set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; } },
      rotation: { y: 0 }
    };
    const characterSpawn = {
      synced: false,
      applied: false,
      getSpawn: () => null,
      setSpawn: () => {},
      syncFromCandidate(candidate: unknown) {
        this.synced = candidate === "spawn";
      },
      applyToCharacter(target: typeof character | null, options: { footOffset: number; standY: number }) {
        this.applied = target === character && options.footOffset === 2 && options.standY === 3.5;
        if (target) target.position.y = options.standY;
      }
    };
    const runtime = new LocalMovementRuntimeService().configure({
      movement,
      collision: {} as any,
      climb: {} as any,
      animation: new AnimationService(),
      physics: null,
      camera: new CameraService(),
      cursor: { mouseLookEnabled: () => false } as any,
      localAvatar: {},
      settingsStore: { readFlag: () => true } as any,
      keys: {},
      cameraObject: { position: { x: 0, y: 0, z: 0, set() {} }, lookAt() {} },
      cameraPivot: { x: 0, y: 0, z: 0, set() {} },
      anim: { time: 0, bones: {}, rest: {} },
      characterSpawn,
      windowRef: { chooseSpawnPoint: () => "spawn", map: {} } as any,
      getCharacter: () => character,
      getNearbyColliders: () => [],
      getMetrics: () => ({ halfWidth: 1, halfDepth: 0.5, height: 5, footOffset: 2, standY: 3.5 }),
      setMouseLock: () => {},
      setFirstPerson: () => {}
    });

    runtime.setVelY(123);
    runtime.setGrounded(false);
    runtime.requestJump();
    runtime.setMovementMods({ fly: true });

    expect(runtime.getVelY()).toBe(0);
    expect(runtime.getGrounded()).toBe(true);
    expect(runtime.getMovementMods().fly).toBe(true);

    expect(runtime.resetCharacterToSpawn()).toBe(true);
    expect(characterSpawn.synced).toBe(true);
    expect(characterSpawn.applied).toBe(true);
    expect(character.position.y).toBe(3.5);
    expect(runtime.getGrounded()).toBe(false);
  });
});
