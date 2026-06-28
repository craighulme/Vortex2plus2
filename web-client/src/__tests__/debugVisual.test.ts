import { describe, expect, it, vi } from "vitest";
import { DebugVisualService } from "../diagnostics/DebugVisualService";

class FakeMesh {
  geometry: { dispose(): void };
  material: { dispose(): void };
  position = { set: vi.fn() };
  rotation = { y: 0 };
  renderOrder = 0;
  setRotationFromMatrix = vi.fn();

  constructor(geometry: { dispose(): void }, material: { dispose(): void }) {
    this.geometry = geometry;
    this.material = material;
  }
}

function createThree() {
  return {
    EdgesGeometry: class {
      dispose = vi.fn();
      constructor(readonly geometry: unknown) {}
    },
    BoxGeometry: class {
      constructor(readonly width: number, readonly height: number, readonly depth: number) {}
    },
    LineBasicMaterial: class {
      dispose = vi.fn();
      constructor(readonly options: Record<string, unknown>) {}
    },
    LineSegments: FakeMesh,
    Matrix4: class {
      set = vi.fn();
    }
  };
}

describe("DebugVisualService", () => {
  it("toggles debug meshes and disposes them when disabled", () => {
    const scene = { add: vi.fn(), remove: vi.fn() };
    const service = new DebugVisualService().configure({
      THREE: createThree(),
      scene,
      getNearbyColliders: () => [{ minX: 0, minY: 0, minZ: 0, maxX: 1, maxY: 1, maxZ: 1 }],
      getColliderSnapshot: () => ({ chunkSize: 16 }),
      worldToChunk: (value) => Math.floor(value / 16)
    });

    expect(service.toggle({ charHalfW: 1, charHalfD: 0.5, charHeight: 5 })).toBe(true);
    service.update({ position: { x: 2, y: 4, z: 3 }, rotation: { y: 1 } }, {
      charHalfW: 1,
      charHalfD: 0.5,
      charHeight: 5,
      charFootOffset: 2
    });

    expect(service.snapshot()).toMatchObject({ enabled: true, colliderMeshes: 1, hasCharacterMesh: true, hasChunkZone: true });
    expect(scene.add).toHaveBeenCalledTimes(3);

    expect(service.toggle({ charHalfW: 1, charHalfD: 0.5, charHeight: 5 })).toBe(false);
    expect(service.snapshot()).toMatchObject({ enabled: false, colliderMeshes: 0, hasCharacterMesh: false, hasChunkZone: false });
    expect(scene.remove).toHaveBeenCalledTimes(3);
  });
});
