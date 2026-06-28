import { describe, expect, it } from "vitest";
import { ClimbService, type ClimbCollider } from "../movement/ClimbService";

const block: ClimbCollider = {
  minX: 0,
  maxX: 2,
  minY: 0.6,
  maxY: 2,
  minZ: 0,
  maxZ: 2
};

describe("ClimbService", () => {
  it("finds a nearby climbable block", () => {
    const service = new ClimbService();

    const found = service.findClimbableBlock({
      px: -0.2,
      pz: 1,
      footY: 1,
      fwdX: 1,
      fwdZ: 0,
      dimensions: { charHalfWidth: 1, charHalfDepth: 0.5, charHeight: 5 },
      getNearbyColliders: () => [block]
    });

    expect(found).toBe(block);
  });

  it("rejects tall ordinary blocks but accepts explicit truss climb surfaces", () => {
    const service = new ClimbService();
    const tallBlock: ClimbCollider = { ...block, minY: 0, maxY: 8 };
    const truss: ClimbCollider = { ...tallBlock, shape: "Block", partType: "Truss", climbable: true };
    const options = {
      px: -0.2,
      pz: 1,
      footY: 1,
      fwdX: 1,
      fwdZ: 0,
      dimensions: { charHalfWidth: 1, charHalfDepth: 0.5, charHeight: 5 },
      getNearbyColliders: () => [tallBlock]
    };

    expect(service.findClimbableBlock(options)).toBeNull();
    expect(service.findClimbableBlock({
      ...options,
      getNearbyColliders: () => [truss]
    })).toBe(truss);
  });

  it("finds chain blocks above and below a ledge", () => {
    const service = new ClimbService();
    const below = { ...block, maxY: 1.2 };
    const above = { ...block, minY: 2.1, maxY: 3.2 };

    expect(service.findChainBlockBelow({
      colliders: [below, above],
      px: 1,
      pz: 1,
      ledgeY: 2,
      fwdX: 1,
      fwdZ: 0,
      dimensions: { charHalfWidth: 1 }
    })).toBe(below);

    expect(service.findChainBlockAbove({
      colliders: [below, above],
      px: 1,
      pz: 1,
      ledgeY: 2,
      fwdX: 1,
      fwdZ: 0,
      dimensions: { charHalfWidth: 1 }
    })).toBe(above);
  });

  it("returns ledge grab data for reachable falling players", () => {
    const service = new ClimbService();

    const result = service.tryLedgeGrab({
      nearby: [block],
      keys: { KeyW: true },
      climbCooldown: 0,
      climbState: "none",
      grounded: false,
      velY: -10,
      character: { position: { x: -0.2, y: 2.4, z: 1 }, rotation: { y: Math.PI / 2 } },
      footOffset: 2,
      stepHeight: 1.4,
      dimensions: { charHalfWidth: 1, charHalfDepth: 0.5, charHeight: 5 }
    });

    expect(result?.block).toBe(block);
    expect(result?.ledgeY).toBe(2);
  });

  it("starts a truss climb from grounded forward input", () => {
    const service = new ClimbService();
    const truss: ClimbCollider = {
      minX: 0,
      maxX: 1,
      minY: 0,
      maxY: 14,
      minZ: 0,
      maxZ: 2,
      shape: "Block",
      partType: "Truss",
      climbable: true
    };

    const result = service.tryLedgeGrab({
      nearby: [truss],
      keys: { KeyW: true },
      climbCooldown: 0,
      climbState: "none",
      grounded: true,
      velY: 0,
      character: { position: { x: -0.2, y: 3, z: 1 }, rotation: { y: Math.PI / 2 } },
      footOffset: 2,
      stepHeight: 1.4,
      dimensions: { charHalfWidth: 1, charHalfDepth: 0.5, charHeight: 5 }
    });

    expect(result).toMatchObject({ block: truss, climbState: "truss" });
    expect(result?.ledgeY).toBeGreaterThan(2);
    expect(result?.ledgeY).toBeLessThan(14);
  });

  it("climbs continuously on truss surfaces instead of snapping to the top", () => {
    const service = new ClimbService();
    const truss: ClimbCollider = { minX: 0, maxX: 1, minY: 0, maxY: 14, minZ: 0, maxZ: 2, partType: "Truss", climbable: true };
    const character = { position: { x: -0.2, y: 3, z: 1 }, rotation: { y: 0 } };

    const result = service.updateHanging({
      state: {
        climbState: "truss",
        climbCooldown: 0,
        climbLedgeY: 2.2,
        climbFwdX: 1,
        climbFwdZ: 0,
        climbBlock: truss,
        velY: 0,
        extraVelX: 0,
        extraVelZ: 0,
        jumpBuffer: 0
      },
      dt: 1 / 60,
      keys: { KeyW: true },
      character,
      camYaw: 0,
      mouseLookEnabled: false,
      rotationSpeed: 10,
      footOffset: 2,
      dimensions: { charHalfWidth: 1, charHalfDepth: 0.5, charHeight: 5 },
      getNearbyColliders: () => [truss]
    });

    expect(result.handled).toBe(true);
    expect(result.state.climbState).toBe("truss");
    expect(result.state.climbLedgeY).toBeLessThan(14);
    expect(character.position.y).toBeGreaterThan(3);
  });

  it("updates hanging climb movement and exits over the ledge", () => {
    const service = new ClimbService();
    const character = { position: { x: -0.2, y: 3.9, z: 1 }, rotation: { y: 0 } };
    const result = service.updateHanging({
      state: {
        climbState: "hanging",
        climbCooldown: 0,
        climbLedgeY: 2,
        climbFwdX: 1,
        climbFwdZ: 0,
        climbBlock: block,
        velY: 0,
        extraVelX: 0,
        extraVelZ: 0,
        jumpBuffer: 0
      },
      dt: 1 / 60,
      keys: { KeyW: true },
      character,
      camYaw: 0,
      mouseLookEnabled: false,
      rotationSpeed: 10,
      footOffset: 2,
      dimensions: { charHalfWidth: 1, charHalfDepth: 0.5, charHeight: 5 },
      getNearbyColliders: () => [block]
    });

    expect(result.handled).toBe(true);
    expect(result.state.climbState).toBe("none");
    expect(result.state.velY).toBe(2);
    expect(character.position.x).toBeGreaterThan(-0.2);
  });

  it("jumps back from a hanging climb state", () => {
    const service = new ClimbService();
    const character = { position: { x: -0.2, y: 3, z: 1 }, rotation: { y: 0 } };
    const result = service.updateHanging({
      state: {
        climbState: "hanging",
        climbCooldown: 0,
        climbLedgeY: 2,
        climbFwdX: 1,
        climbFwdZ: 0,
        climbBlock: block,
        velY: 0,
        extraVelX: 0,
        extraVelZ: 0,
        jumpBuffer: 0.05
      },
      dt: 1 / 60,
      keys: {},
      character,
      camYaw: 0,
      mouseLookEnabled: false,
      rotationSpeed: 10,
      footOffset: 2,
      dimensions: { charHalfWidth: 1, charHalfDepth: 0.5, charHeight: 5 },
      getNearbyColliders: () => [block]
    });

    expect(result.handled).toBe(true);
    expect(result.state.climbState).toBe("none");
    expect(result.state.velY).toBe(service.constants.jumpUp);
    expect(result.state.extraVelX).toBe(-service.constants.jumpBackSpeed);
    expect(result.state.jumpBuffer).toBe(0);
  });
});
