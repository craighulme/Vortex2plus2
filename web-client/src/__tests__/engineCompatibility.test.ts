import { describe, expect, it } from "vitest";
import { EngineCompatibilityService } from "../runtime/EngineCompatibilityService";

describe("EngineCompatibilityService", () => {
  it("installs engine globals and legacy handles in one place", () => {
    const service = new EngineCompatibilityService();
    const windowRef = new EventTarget() as Window & Record<string, unknown>;
    const rendererHandles: unknown[] = [];
    const worldHandles: Record<string, unknown>[] = [];
    let readyDetail: unknown = null;
    windowRef.addEventListener("vortex-engine-ready", (event) => {
      readyDetail = (event as CustomEvent).detail;
    });
    const vortexApi = {
      setSpawn: () => undefined,
      pick: () => undefined,
      getObjects: () => [],
      getColliders: () => []
    };

    service.install({
      windowRef,
      three: "three",
      gltfLoaderClass: "GLTFLoader",
      gltfLoader: "loader",
      scene: "scene",
      ambient: "ambient",
      renderer: "renderer",
      objects: [],
      camera: "camera",
      cam: "cam",
      vortexApi,
      rendererService: { attachLegacy: (handles) => rendererHandles.push(handles) },
      worldService: { attachLegacy: (handles) => worldHandles.push(handles) },
      worldHandles: {
        addStud: "addStud",
        removeStud: "removeStud",
        createMesh: () => ({}),
        createGeometry: () => ({}),
        scene: "scene",
        objects: [],
        bufferGeometryUtils: "buffer",
        shadowsActive: () => true
      },
      cursorOver: () => false
    });

    expect(windowRef._vortex).toBe(vortexApi);
    expect(windowRef.THREE).toBe("three");
    expect(rendererHandles[0]).toMatchObject({ scene: "scene", camera: "camera", renderer: "renderer" });
    expect(worldHandles[0]).toMatchObject({ addStud: "addStud", setSpawn: vortexApi.setSpawn });
    expect(readyDetail).toBe(vortexApi);
  });
});
