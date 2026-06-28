import { describe, expect, it } from "vitest";
import { RendererService } from "../renderer/RendererService";

class FakeDirectionalLight {
  castShadow = false;
  position = {
    set: (x: number, y: number, z: number) => {
      this.positionValue = [x, y, z];
    }
  };
  positionValue = [0, 0, 0];
  shadow = {
    mapSize: { width: 0, height: 0 },
    camera: {},
    autoUpdate: false,
    bias: 0,
    shadowNode: undefined as unknown
  };
  target: unknown = null;

  constructor(
    readonly color: number,
    readonly intensity: number
  ) {}
}

class FakeObject3D {
  position = {
    set: (x: number, y: number, z: number) => {
      this.positionValue = [x, y, z];
    }
  };
  positionValue = [0, 0, 0];
}

class FakeCsmShadowNode {
  static disposed = 0;
  static frustumUpdates = 0;

  camera = { near: 0.1, far: 500, fov: 85, aspect: 1.5, zoom: 1 };
  maxFar: number;
  cascades: number;
  mode: string;

  constructor(
    readonly light: unknown,
    options: { maxFar: number; cascades: number; mode: "practical"; lightMargin: number; fade: boolean }
  ) {
    this.maxFar = options.maxFar;
    this.cascades = options.cascades;
    this.mode = options.mode;
  }

  updateFrustums(): void {
    FakeCsmShadowNode.frustumUpdates += 1;
  }

  dispose(): void {
    FakeCsmShadowNode.disposed += 1;
  }
}

describe("ShadowService", () => {
  it("is constructed by RendererService and applies scene shadow state", () => {
    const mesh = {
      isMesh: true,
      castShadow: false,
      receiveShadow: false,
      material: { needsUpdate: false },
      userData: {}
    };
    const noCastMesh = {
      isMesh: true,
      castShadow: false,
      receiveShadow: false,
      material: { needsUpdate: false },
      userData: { vwebDisableCastShadow: true }
    };
    const scene = {
      added: [] as unknown[],
      add(...objects: unknown[]) {
        this.added.push(...objects);
      },
      traverse(visitor: (object: typeof mesh) => void) {
        visitor(mesh);
        visitor(noCastMesh as typeof mesh);
      }
    };
    const renderer = { shadowMap: { enabled: false, needsUpdate: false, type: null as unknown } };

    const service = new RendererService().createShadowService({
      THREE: {
        DirectionalLight: FakeDirectionalLight,
        Object3D: FakeObject3D,
        PCFShadowMap: "pcf"
      },
      scene,
      camera: { near: 0.1, far: 3200, fov: 85, aspect: 1.5, zoom: 1 },
      renderer,
      backend: "webgpu",
      enabled: true,
      shadowConfig: { quality: "medium", mapSize: 2048, cascades: 4, maxFar: 500, lightMargin: 200, fade: true },
      CSMShadowNode: FakeCsmShadowNode
    });

    expect(scene.added).toHaveLength(3);
    expect(renderer.shadowMap.enabled).toBe(true);
    expect(service.snapshot()).toMatchObject({
      active: true,
      backend: "webgpu",
      implementation: "CSMShadowNode",
      quality: "medium",
      cascades: 4,
      shadowMapSize: 2048
    });

    service.syncObjectShadowFlags(scene);
    expect(mesh.castShadow).toBe(true);
    expect(mesh.receiveShadow).toBe(true);
    expect(noCastMesh.castShadow).toBe(false);
    expect(noCastMesh.receiveShadow).toBe(true);

    service.markSceneMaterialsForUpdate(scene);
    expect(mesh.material.needsUpdate).toBe(true);
    expect(noCastMesh.material.needsUpdate).toBe(true);
  });

  it("reconfigures CSM without duplicating renderer policy", () => {
    FakeCsmShadowNode.disposed = 0;
    const scene = {
      add() {},
      traverse() {}
    };
    const renderer = { shadowMap: { enabled: true, needsUpdate: false, type: null as unknown } };
    const service = new RendererService().createShadowService({
      THREE: {
        DirectionalLight: FakeDirectionalLight,
        Object3D: FakeObject3D,
        PCFShadowMap: "pcf"
      },
      scene,
      camera: {},
      renderer,
      backend: "webgpu",
      enabled: true,
      shadowConfig: { quality: "medium", mapSize: 2048, cascades: 4, maxFar: 500, lightMargin: 200, fade: true },
      CSMShadowNode: FakeCsmShadowNode
    });

    expect(service.reconfigure({ quality: "ultra", mapSize: 4096, cascades: 4, maxFar: 850, lightMargin: 260, fade: true })).toMatchObject({
      quality: "ultra",
      shadowMapSize: 4096,
      maxFar: 850
    });
    expect(FakeCsmShadowNode.disposed).toBe(1);
    expect(renderer.shadowMap.needsUpdate).toBe(true);
  });
});
