import { describe, expect, it } from "vitest";
import { MovementService } from "../movement/MovementService";

describe("MovementService", () => {
  it("exposes the current Vortex movement constants", () => {
    const movement = new MovementService();

    expect(movement.snapshotConstants()).toEqual({
      walkSpeed: 16,
      jumpPower: 50,
      gravity: -196.2,
      rotationSpeed: 10,
      stepHeight: 1.4,
      stepClimbSpeed: 32
    });
  });

  it("normalizes movement modifier patches", () => {
    const movement = new MovementService();

    const update = movement.setMods({
      fly: true,
      noclip: 1 as unknown as boolean,
      gravityScale: 99,
      flySpeed: -10
    });

    expect(update).toEqual({
      mods: {
        fly: true,
        noclip: true,
        airwalk: false,
        gravityScale: 8,
        flySpeed: 2
      },
      shouldResetVerticalState: true
    });
  });

  it("keeps snapshots immutable from callers", () => {
    const movement = new MovementService();
    const mods = movement.snapshotMods();
    mods.fly = true;

    expect(movement.snapshotMods().fly).toBe(false);
  });

  it("computes camera-relative planar movement intent", () => {
    const movement = new MovementService();

    const forward = movement.computePlanarIntent({ forward: true, yaw: 0, speed: 16 });
    expect(forward).toMatchObject({ moving: true, velocityX: 0, velocityZ: -16 });
    expect(forward.targetAngle).toBeCloseTo(Math.PI);

    const turned = movement.computePlanarIntent({ forward: true, yaw: Math.PI / 2, speed: 16 });
    expect(turned.velocityX).toBeCloseTo(-16);
    expect(turned.velocityZ).toBeCloseTo(0);
  });

  it("normalizes diagonal movement intent to the requested speed", () => {
    const movement = new MovementService();
    const diagonal = movement.computePlanarIntent({ forward: true, right: true, yaw: 0, speed: 16 });
    const speed = Math.sqrt(diagonal.velocityX * diagonal.velocityX + diagonal.velocityZ * diagonal.velocityZ);

    expect(diagonal.moving).toBe(true);
    expect(speed).toBeCloseTo(16);
  });

  it("applies extra planar velocity and clamps to max speed", () => {
    const movement = new MovementService();
    const result = movement.applyPlanarImpulse({
      velocityX: 16,
      velocityZ: 0,
      extraVelX: 16,
      extraVelZ: 0,
      maxSpeed: 16
    });

    expect(result.velocityX).toBeCloseTo(16);
    expect(result.velocityZ).toBeCloseTo(0);
  });

  it("decays tiny extra velocity to zero", () => {
    const movement = new MovementService();

    expect(movement.decayExtraVelocity({ extraVelX: 0.2, extraVelZ: 4, dt: 0.1 })).toEqual({
      extraVelX: 0,
      extraVelZ: 3
    });
  });

  it("applies step-up targets through the movement service", () => {
    const movement = new MovementService();
    const character = { position: { y: 2 } };
    const state = movement.applyStepUp({
      character,
      stepUpTarget: 4,
      dt: 1 / 32,
      stepClimbSpeed: 32,
      velY: -10,
      grounded: false
    });

    expect(character.position.y).toBe(3);
    expect(state).toEqual({ velY: 0, grounded: true });
  });

  it("applies fly, gravity, and jump consumption rules", () => {
    const movement = new MovementService();
    const character = { position: { y: 10 } };
    const flyState = movement.applyVerticalMode({
      character,
      mods: { fly: true, noclip: false, airwalk: false, gravityScale: 1, flySpeed: 20 },
      keys: { Space: true },
      dt: 0.5,
      state: { velY: -1, grounded: false, coyoteTimer: 0, jumpBuffer: 1, extraVelX: 0, extraVelZ: 0 }
    });

    expect(character.position.y).toBe(20);
    expect(flyState).toMatchObject({ velY: 0, grounded: true, jumpBuffer: 0 });

    const jump = movement.consumeJump({
      mods: { fly: false, noclip: false, airwalk: false, gravityScale: 1, flySpeed: 20 },
      state: { velY: -5, grounded: true, coyoteTimer: 0, jumpBuffer: 0.01, extraVelX: 0, extraVelZ: 0 }
    });
    expect(jump).toEqual({ velY: 50, grounded: false, coyoteTimer: 0, jumpBuffer: 0 });
  });

  it("keeps a newly pressed jump buffered for the current frame", () => {
    const movement = new MovementService();

    const buffered = movement.updateJumpWindows({
      grounded: true,
      coyoteTimer: 0,
      jumpBuffer: 0,
      jumpPressed: true,
      dt: 0.05,
      coyoteTime: 0.12,
      jumpBufferWindow: 0.05
    });

    expect(buffered).toEqual({ coyoteTimer: 0.12, jumpBuffer: 0.05 });
    expect(movement.consumeJump({
      mods: movement.snapshotMods(),
      state: { velY: 0, grounded: true, coyoteTimer: buffered.coyoteTimer, jumpBuffer: buffered.jumpBuffer, extraVelX: 0, extraVelZ: 0 }
    })).toMatchObject({ velY: 50, grounded: false, jumpBuffer: 0 });
  });
});
