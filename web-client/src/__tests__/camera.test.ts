import { describe, expect, it } from "vitest";
import { CameraService } from "../camera/CameraService";

describe("CameraService", () => {
  it("applies pointer look with pitch clamping", () => {
    const camera = new CameraService();

    camera.pointerLook(100, 100000);

    expect(camera.state.yaw).toBeLessThan(0);
    expect(camera.state.pitch).toBe(camera.state.maxPitch);
  });

  it("keeps the legacy wheel zoom clamp", () => {
    const camera = new CameraService();

    camera.zoomWheel(-100000);
    camera.smoothDistance(1);

    expect(camera.state.distance).toBe(camera.state.minDist);
  });

  it("computes the third-person camera transform from the character pivot", () => {
    const camera = new CameraService();
    const transform = camera.computeTransform(
      { position: { x: 10, y: 20, z: 30 } },
      { shiftLock: false, footOffset: 2 }
    );

    expect(transform.firstPerson).toBe(false);
    expect(transform.pivot).toEqual([10, 22.64, 30]);
    expect(transform.position[0]).toBeCloseTo(10);
    expect(transform.position[1]).toBeGreaterThan(transform.pivot[1]);
    expect(transform.position[2]).toBeGreaterThan(transform.pivot[2]);
  });

  it("offsets the pivot for shift lock and first person", () => {
    const camera = new CameraService();

    const shiftLock = camera.computeTransform(
      { position: { x: 0, y: 0, z: 0 } },
      { shiftLock: true, footOffset: 2 }
    );
    expect(shiftLock.pivot[0]).toBeCloseTo(1.75);

    camera.zoomWheel(-100000);
    camera.smoothDistance(1);
    const firstPerson = camera.computeTransform(
      { position: { x: 0, y: 0, z: 0 } },
      { shiftLock: true, footOffset: 2 }
    );

    expect(firstPerson.firstPerson).toBe(true);
    expect(firstPerson.pivot[2]).toBeCloseTo(-1);
  });
});
