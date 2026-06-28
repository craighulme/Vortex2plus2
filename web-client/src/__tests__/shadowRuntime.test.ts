import { describe, expect, it } from "vitest";
import { ShadowRuntimeService } from "../renderer/ShadowRuntimeService";

class FakeAmbientLight {
  constructor(readonly color: number, readonly intensity: number) {}
}

class FakeShadowService {
  sun = { id: "sun" };
  sunTarget = { id: "sunTarget" };
  backLight = { id: "backLight" };
  enabled = false;
  syncedRoot: unknown = null;
  reconfiguredWith: unknown = null;
  updates = 0;

  setEnabled(value: boolean) {
    this.enabled = value;
    return this.enabled;
  }
  active() {
    return this.enabled;
  }
  syncObjectShadowFlags(root: unknown) {
    this.syncedRoot = root;
  }
  reconfigure(config: unknown) {
    this.reconfiguredWith = config;
    return this.snapshot();
  }
  update() {
    this.updates += 1;
  }
  snapshot() {
    return { enabled: this.enabled, active: this.enabled, technique: "csm" };
  }
}

describe("ShadowRuntimeService", () => {
  it("owns shadow setup, persistence, and quality changes", () => {
    const scene = { added: [] as unknown[], add(...objects: unknown[]) { this.added.push(...objects); } };
    const storageValues = new Map<string, string>();
    const storage = {
      getItem: (key: string) => storageValues.get(key) ?? null,
      setItem: (key: string, value: string) => { storageValues.set(key, value); },
      removeItem: (key: string) => { storageValues.delete(key); }
    } as Storage;
    const fakeShadow = new FakeShadowService();
    const rendererService = {
      getShadowConfig: () => ({ quality: "medium", mapSize: 2048, cascades: 4, maxFar: 500, lightMargin: 200, fade: true }),
      setShadowQuality: (quality: string) => ({ quality, mapSize: 4096, cascades: 4, maxFar: 850, lightMargin: 240, fade: true }),
      detectRendererBackend: () => "webgpu",
      createShadowService: () => fakeShadow
    };
    const sceneSettings = { marks: 0, markMaterialsForShaderUpdate() { this.marks += 1; } };

    const handles = new ShadowRuntimeService().configure({
      THREE: { AmbientLight: FakeAmbientLight, PCFSoftShadowMap: "pcf-soft" },
      scene,
      camera: {},
      renderer: { userData: { vwebBackend: "webgpu" }, shadowMap: {} },
      rendererService: rendererService as any,
      sceneSettings: sceneSettings as any,
      CSMShadowNode: function CSMShadowNode() {} as any,
      storage,
      readStorageNumber: () => 2048,
      enabled: true
    });

    expect(scene.added[0]).toBeInstanceOf(FakeAmbientLight);
    expect(handles.active()).toBe(true);
    expect(storage.getItem("enableShadows")).toBe("yes");
    expect(handles.sun).toEqual({ id: "sun" });

    handles.setEnabled(false);
    expect(handles.active()).toBe(false);
    expect(storage.getItem("enableShadows")).toBe("no");
    expect(sceneSettings.marks).toBe(1);

    handles.setQuality("ultra");
    expect(fakeShadow.reconfiguredWith).toMatchObject({ quality: "ultra", mapSize: 4096 });
    expect(storage.getItem("vwebShadowQuality")).toBe("ultra");
    expect(sceneSettings.marks).toBe(2);

    handles.updateForFrame();
    expect(fakeShadow.updates).toBe(1);
  });
});
