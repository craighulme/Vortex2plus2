import { describe, expect, it } from "vitest";
import { WorldColliderService } from "../world/WorldColliderService";

class FakeMatrix4 {
  makeRotationFromEuler() {
    return {
      elements: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]
    };
  }
}

class FakeEuler {
  constructor(
    readonly rx: number,
    readonly ry: number,
    readonly rz: number,
    readonly order?: string
  ) {}
}

class FakeBox3 {
  min = { x: 0, y: 0, z: 0 };
  max = { x: 0, y: 0, z: 0 };

  setFromObject(object: unknown) {
    const typed = object as { bounds: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number } } };
    this.min = typed.bounds.min;
    this.max = typed.bounds.max;
    return this;
  }
}

describe("WorldColliderService", () => {
  it("indexes colliders into nearby chunk queries and removes them", () => {
    const service = new WorldColliderService(4).configure({
      Matrix4: FakeMatrix4,
      Euler: FakeEuler,
      Box3: FakeBox3
    });

    const collider = service.createCollider(4, 2, 4, 10, 1, 10);
    service.add(collider);

    expect(service.colliders).toHaveLength(1);
    expect(service.getNearbyColliders(10, 2, 10).has(collider)).toBe(true);
    expect(service.snapshot()).toMatchObject({ colliders: 1, chunkSize: 4 });

    service.remove(collider);

    expect(service.colliders).toHaveLength(0);
    expect(service.getNearbyColliders(10, 2, 10).has(collider)).toBe(false);
  });

  it("preserves shape metadata for explicit truss climb surfaces", () => {
    const service = new WorldColliderService(4).configure({
      Matrix4: FakeMatrix4,
      Euler: FakeEuler,
      Box3: FakeBox3
    });

    expect(service.createCollider(2, 8, 2, 0, 0, 0, 0, 0, 0, "YXZ", "Block", "Truss")).toMatchObject({
      shape: "Block",
      partType: "Truss",
      climbable: true
    });

    expect(service.createCollider(2, 8, 2, 0, 0, 0, 0, 0, 0, "YXZ", "Block")).toMatchObject({
      shape: "Block"
    });
  });

  it("rebuilds an axis-aligned collider from an object bounds box", () => {
    const service = new WorldColliderService().configure({
      Matrix4: FakeMatrix4,
      Euler: FakeEuler,
      Box3: FakeBox3
    });

    expect(service.rebuildFromObject({
      bounds: {
        min: { x: -1, y: 2, z: -3 },
        max: { x: 4, y: 5, z: 6 }
      }
    })).toEqual({
      minX: -1,
      maxX: 4,
      minY: 2,
      maxY: 5,
      minZ: -3,
      maxZ: 6
    });
  });

  it("preserves rebuilt collider shape metadata from object userData", () => {
    const service = new WorldColliderService().configure({
      Matrix4: FakeMatrix4,
      Euler: FakeEuler,
      Box3: FakeBox3
    });

    expect(service.rebuildFromObject({
      userData: { vwebPartShape: "Block", vwebPartType: "Truss" },
      bounds: {
        min: { x: -1, y: 2, z: -3 },
        max: { x: 4, y: 5, z: 6 }
      }
    })).toMatchObject({
      shape: "Block",
      partType: "Truss",
      climbable: true
    });
  });

  it("snaps a root Y to nearby collider tops only inside tolerance", () => {
    const service = new WorldColliderService(4).configure({
      Matrix4: FakeMatrix4,
      Euler: FakeEuler,
      Box3: FakeBox3
    });
    service.add(service.createCollider(20, 3, 20, 0, 0, 0));

    expect(service.snapRootYToGround({
      x: 0,
      y: 5.08,
      z: 0,
      halfWidth: 1,
      halfDepth: 0.5,
      footOffset: 2,
      tolerance: 0.18
    })).toBe(5);

    expect(service.snapRootYToGround({
      x: 0,
      y: 5.5,
      z: 0,
      halfWidth: 1,
      halfDepth: 0.5,
      footOffset: 2,
      tolerance: 0.18
    })).toBe(5.5);
  });

  it("supports a wider downward snap window for remote grounded avatars", () => {
    const service = new WorldColliderService(4).configure({
      Matrix4: FakeMatrix4,
      Euler: FakeEuler,
      Box3: FakeBox3
    });
    service.add(service.createCollider(20, 3, 20, 0, 0, 0));

    expect(service.snapRootYToGround({
      x: 0,
      y: 7.5,
      z: 0,
      halfWidth: 1,
      halfDepth: 0.5,
      footOffset: 2,
      snapDown: 2.75,
      snapUp: 0.35
    })).toBe(5);

    expect(service.snapRootYToGround({
      x: 0,
      y: 7.9,
      z: 0,
      halfWidth: 1,
      halfDepth: 0.5,
      footOffset: 2,
      snapDown: 2.75,
      snapUp: 0.35
    })).toBe(7.9);
  });
});
