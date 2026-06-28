import { describe, expect, it } from "vitest";
import { CharacterCollisionService, type CharacterCollider, type OrientedCollider } from "../movement/CharacterCollisionService";

describe("CharacterCollisionService", () => {
  it("detects planar overlap against axis-aligned colliders", () => {
    const service = new CharacterCollisionService();
    const overlap = service.planarOverlap(0, 0, 1, 0, {
      minX: -0.5,
      maxX: 0.5,
      minY: 0,
      maxY: 1,
      minZ: -0.5,
      maxZ: 0.5
    }, { halfWidth: 1, halfDepth: 0.5 });

    expect(overlap).not.toBeNull();
    expect(overlap?.ov0).toBeCloseTo(1.5);
    expect(overlap?.ov1).toBeCloseTo(1);
  });

  it("returns null when planar colliders are separated", () => {
    const service = new CharacterCollisionService();
    const overlap = service.planarOverlap(10, 0, 1, 0, {
      minX: -0.5,
      maxX: 0.5,
      minY: 0,
      maxY: 1,
      minZ: -0.5,
      maxZ: 0.5
    }, { halfWidth: 1, halfDepth: 0.5 });

    expect(overlap).toBeNull();
  });

  it("calculates an MTV for oriented blocks against the character", () => {
    const service = new CharacterCollisionService();
    const collider: OrientedCollider = {
      minX: -1,
      maxX: 1,
      minY: 0,
      maxY: 2,
      minZ: -1,
      maxZ: 1,
      cx: 0,
      cy: 1,
      cz: 0,
      hx: 1,
      hy: 1,
      hz: 1,
      ux: 1,
      uy: 0,
      uz: 0,
      vx: 0,
      vy: 1,
      vz: 0,
      wx: 0,
      wy: 0,
      wz: 1
    };

    const mtv = service.mtvObbVsCharacter({
      position: { x: 0.25, y: 2, z: 0 },
      rotation: { y: 0 }
    }, collider, {
      halfWidth: 1,
      halfDepth: 0.5,
      height: 5,
      footOffset: 2
    });

    expect(mtv).not.toBeNull();
    expect(mtv?.depth).toBeGreaterThan(0);
  });

  it("clamps axis sweep movement against blocking colliders", () => {
    const service = new CharacterCollisionService();
    const character = {
      position: { x: 0, y: 2, z: 0 },
      rotation: { y: 0 }
    };

    expect(service.sweepAxisAligned({
      character,
      colliders: [{ minX: 2, maxX: 4, minY: 0, maxY: 4, minZ: -2, maxZ: 2 }],
      delta: 5,
      axis: "x",
      dimensions: { halfWidth: 1, halfDepth: 0.5, height: 5, footOffset: 2 },
      stepHeight: 1.4,
      canStep: false,
      velY: 0
    })).toBe(1);
  });

  it("returns step-up targets instead of pushing through step-height blocks", () => {
    const service = new CharacterCollisionService();
    const pushed = new Set<CharacterCollider>();
    const character = {
      position: { x: 0, y: 2, z: 0 },
      rotation: { y: 0 }
    };

    const stepTarget = service.resolveAxisAlignedHorizontal({
      character,
      colliders: [{ minX: -1, maxX: 1, minY: 0, maxY: 1, minZ: -1, maxZ: 1 }],
      dt: 1 / 60,
      dimensions: { halfWidth: 1, halfDepth: 0.5, height: 5, footOffset: 2 },
      stepHeight: 1.4,
      stepClimbSpeed: 32,
      canStep: true,
      velY: 0,
      stepUpTarget: -Infinity,
      pushedColliders: pushed
    });

    expect(stepTarget).toBe(3);
    expect(pushed.size).toBe(0);
  });

  it("grounds vertical collisions and clears extra velocity", () => {
    const service = new CharacterCollisionService();
    const character = {
      position: { x: 0, y: 2.8, z: 0 },
      rotation: { y: 0 }
    };

    const state = service.resolveAxisAlignedVertical({
      character,
      colliders: [{ minX: -4, maxX: 4, minY: 0, maxY: 1, minZ: -4, maxZ: 4 }],
      dt: 1 / 60,
      dimensions: { halfWidth: 1, halfDepth: 0.5, height: 5, footOffset: 2 },
      stepClimbSpeed: 32,
      state: { velY: -10, grounded: false, extraVelX: 3, extraVelZ: 4 },
      pushedColliders: new Set()
    });

    expect(state).toMatchObject({ velY: 0, grounded: true, extraVelX: 0, extraVelZ: 0 });
    expect(character.position.y).toBeGreaterThan(2.8);
  });
});
