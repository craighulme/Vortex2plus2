import { describe, expect, it } from "vitest";
import { WorldPickingService } from "../world/WorldPickingService";

const raycasterState = {
  mouse: null as { x: number; y: number } | null,
  camera: null as unknown,
  intersections: [] as Array<{ point: unknown; face?: { normal?: unknown }; object: unknown }>
};

class FakeRaycaster {
  setFromCamera(mouse: unknown, camera: unknown) {
    raycasterState.mouse = mouse as { x: number; y: number };
    raycasterState.camera = camera;
  }

  intersectObjects() {
    return raycasterState.intersections;
  }
}

class FakeVector3 {
  x = 0;
  y = 0;
}

describe("WorldPickingService", () => {
  it("normalizes cursor coordinates and returns the nearest hit", () => {
    const service = new WorldPickingService().configure({ Raycaster: FakeRaycaster, Vector3: FakeVector3 });
    const camera = { id: "camera" };
    const object = { id: "part" };
    raycasterState.intersections = [{ point: { x: 1 }, face: { normal: { y: 1 } }, object }];

    expect(service.pick(camera, [object], 400, 150, 800, 600)).toEqual([{ x: 1 }, { y: 1 }, object]);
    expect(raycasterState.mouse).toEqual({ x: 0, y: 0.5 });
    expect(raycasterState.camera).toBe(camera);
  });

  it("keeps the legacy false tuple when nothing is hit", () => {
    const service = new WorldPickingService().configure({ Raycaster: FakeRaycaster, Vector3: FakeVector3 });
    raycasterState.intersections = [];

    expect(service.pick({}, [], 0, 0, 800, 600)).toEqual([false, false, false]);
  });
});
