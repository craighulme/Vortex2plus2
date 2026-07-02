import { describe, expect, it } from "vitest";
import { RuntimeApiExportService, type RuntimeApi } from "../runtime/RuntimeApiExportService";

describe("RuntimeApiExportService", () => {
  it("installs runtime globals and adapter handles in one place", () => {
    const service = new RuntimeApiExportService();
    const windowRef = new EventTarget() as Window & Record<string, unknown>;
    const rendererHandles: unknown[] = [];
    const worldHandles: Record<string, unknown>[] = [];
    let readyDetail: unknown = null;
    let installedRuntimeApi: unknown = null;
    windowRef.addEventListener("vweb-runtime-exports-ready", (event) => {
      readyDetail = (event as CustomEvent).detail;
    });
    const runtimeApi = {
      setSpawn: () => undefined,
      pick: () => undefined,
      getObjects: () => [],
      getColliders: () => []
    } as unknown as RuntimeApi;

    service.install({
      windowRef,
      three: "three",
      scene: "scene",
      renderer: "renderer",
      camera: "camera",
      runtimeApi,
      setRuntimeApi: (value) => {
        installedRuntimeApi = value;
      },
      rendererService: { attachRuntimeAdapter: (handles) => rendererHandles.push(handles) },
      worldService: { attachRuntimeAdapter: (handles) => worldHandles.push(handles) },
      worldHandles: {
        spawnPart: () => ["part", 1],
        removeObject: () => undefined,
        spawnMesh: () => ({}),
        createBatchMesh: () => ({}),
        createRuntimeMesh: () => ({}),
        createGeometry: () => ({}),
        scene: "scene",
        objects: [],
        bufferGeometryUtils: "buffer",
        shadowsActive: () => true
      }
    });

    expect(windowRef._vortex).toBeUndefined();
    expect(installedRuntimeApi).toBe(runtimeApi);
    expect(windowRef.THREE).toBeUndefined();
    expect(rendererHandles[0]).toMatchObject({ three: "three", scene: "scene", camera: "camera", renderer: "renderer" });
    expect(worldHandles[0]).toMatchObject({ setSpawn: runtimeApi.setSpawn });
    expect(typeof worldHandles[0]?.spawnPart).toBe("function");
    expect(readyDetail).toBe(runtimeApi);
  });
});
