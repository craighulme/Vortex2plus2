type ThreeLike = {
  Vector3: new () => unknown;
};

export type EngineLocalPlayerRuntimeOptions = {
  THREE: ThreeLike;
  runtime: Record<string, any>;
  cameraObject: unknown;
  animationState: unknown;
  characterSpawn: unknown;
  localAvatar: unknown;
  windowRef: Window;
  getCharacter(): unknown;
  getNearbyColliders(px: number, py: number, pz: number): Set<unknown>;
  getMetrics(): unknown;
  setMouseLock(value: boolean): void;
  setFirstPerson(value: boolean): void;
};

export type EngineLocalPlayerRuntimeHandles = {
  localMovement: any;
  cameraState: unknown;
};

export class EngineLocalPlayerRuntimeService {
  configure(options: EngineLocalPlayerRuntimeOptions): EngineLocalPlayerRuntimeHandles {
    const localMovement = options.runtime.localMovement.configure?.({
      movement: requireRuntimeService(options.runtime.movement, "movement"),
      collision: requireRuntimeService(options.runtime.characterCollision, "character collision"),
      climb: requireRuntimeService(options.runtime.climb, "climb"),
      animation: options.runtime.animation,
      physics: options.runtime.physics,
      camera: requireRuntimeService(options.runtime.camera, "camera"),
      cursor: options.runtime.cursor,
      localAvatar: options.localAvatar,
      settingsStore: options.runtime.settingsStore,
      keys: options.runtime.input.keys,
      cameraObject: options.cameraObject,
      cameraPivot: new options.THREE.Vector3(),
      anim: options.animationState,
      characterSpawn: options.characterSpawn,
      windowRef: options.windowRef,
      getCharacter: options.getCharacter,
      getNearbyColliders: options.getNearbyColliders,
      getMetrics: options.getMetrics,
      setMouseLock: options.setMouseLock,
      setFirstPerson: options.setFirstPerson
    });
    if (!localMovement) {
      throw new Error("[movement] VortexRuntime local movement service is required before the engine starts.");
    }

    return {
      localMovement,
      cameraState: options.runtime.camera.state
    };
  }
}

function requireRuntimeService<T>(service: T | null | undefined, name: string): T {
  if (!service) {
    throw new Error(`[movement] VortexRuntime ${name} service is required before the engine starts.`);
  }
  return service;
}
