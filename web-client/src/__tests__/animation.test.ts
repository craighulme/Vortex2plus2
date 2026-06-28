import { afterEach, describe, expect, it, vi } from "vitest";
import { AnimationService, type LegacyBoneLike } from "../animation/AnimationService";

function bone(): LegacyBoneLike {
  return {
    rotation: { x: 0, y: 0, z: 0 },
    position: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }
  };
}

describe("AnimationService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("owns legacy remote walk/jump/climb pose animation", () => {
    const service = new AnimationService();
    const remote = {
      anim: "jump",
      animTime: 0,
      meshes: {
        bones: {
          Left_Arm: bone(),
          Right_Arm: bone(),
          Left_Leg: bone(),
          Right_Leg: bone(),
          Torso: bone()
        },
        rest: {
          Left_Arm: { x: 0, z: 0, py: 0 },
          Right_Arm: { x: 0, z: 0, py: 0 },
          Left_Leg: { x: 0 },
          Right_Leg: { x: 0 },
          Torso: { x: 0, z: 0 }
        }
      }
    };

    service.animateLegacyRemote(remote, 1 / 60);

    expect(remote.animTime).toBeGreaterThan(0);
    expect(remote.meshes.bones.Left_Arm.rotation.x).toBeLessThan(0);
    expect(remote.meshes.bones.Right_Arm.position.y).toBeLessThan(0);
  });

  it("owns local foot IK state and bone offsets", () => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => key === "vwebExperimentalFootIk" ? "1" : null
    });
    const service = new AnimationService();
    service.setFootIk({ enabled: true, smoothing: 30, footProbeDistance: 2.5, maxLegExtension: 1.35 });
    const leftLeg = bone();
    const rightLeg = bone();
    const torso = bone();
    const animation = {
      time: 0,
      bones: { Left_Leg: leftLeg, Right_Leg: rightLeg, Torso: torso },
      rest: {
        Left_Leg: { px: 0.8, py: 0, pz: 0, sy: 1 },
        Right_Leg: { px: -0.8, py: 0, pz: 0, sy: 1 },
        Torso: { py: 0 }
      }
    };

    const state = service.applyLocalFootIk({
      animation,
      character: { position: { x: 0, y: 3, z: 0 }, rotation: { y: 0 } },
      physics: {
        snapshot: () => ({ status: "ready" }),
        castRay: () => ({ point: [0, 0.5, 0] })
      },
      dt: 1 / 30,
      moving: false,
      grounded: true,
      footOffset: 2,
      charHeight: 5
    });

    expect(state.active).toBe(true);
    expect(state.leftY).toBeLessThan(0);
    expect(leftLeg.position.y).toBeLessThan(0);
  });
});
