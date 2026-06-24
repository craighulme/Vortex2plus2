import { describe, expect, it } from "vitest";
import { createPhysicsWorld } from "../physics/createPhysicsWorld";

const diagnostics = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined
};

describe("PhysicsWorld", () => {
  it("keeps the legacy backend available as a rollback path", () => {
    const physics = createPhysicsWorld({ backend: "legacy", diagnostics });
    physics.syncStaticCollidersFromLegacy?.([
      { minX: -2, maxX: 2, minY: 0, maxY: 1, minZ: -2, maxZ: 2 }
    ]);

    expect(physics.snapshot()).toMatchObject({
      backend: "legacy",
      status: "legacy",
      colliders: 1
    });
  });

  it("loads Rapier and raycasts against synced static colliders", async () => {
    const physics = createPhysicsWorld({ backend: "rapier", diagnostics });
    physics.syncStaticCollidersFromLegacy?.([
      { minX: -2, maxX: 2, minY: 0, maxY: 1, minZ: -2, maxZ: 2 }
    ]);

    await waitFor(() => physics.snapshot().status === "ready");

    const hit = physics.castRay([0, 5, 0], [0, -1, 0], 20);
    expect(hit?.collider).toBe("legacy-0");
    expect(hit?.point[1]).toBeCloseTo(1, 4);
    expect(physics.snapshot().colliders).toBe(1);
    physics.dispose();
  });
});

async function waitFor(predicate: () => boolean): Promise<void> {
  const start = performance.now();
  while (!predicate()) {
    if (performance.now() - start > 3000) throw new Error("timed out waiting for physics");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}
