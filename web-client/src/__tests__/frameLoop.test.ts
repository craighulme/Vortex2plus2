import { describe, expect, it } from "vitest";
import { FrameLoopService } from "../runtime/FrameLoopService";

describe("FrameLoopService", () => {
  it("runs frame callbacks in engine order and clamps dt", () => {
    const service = new FrameLoopService();
    const calls: string[] = [];
    service.start({
      windowRef: { requestAnimationFrame: () => 0 } as any,
      now: () => 0,
      profiler: {
        begin: (now) => {
          calls.push(`begin:${now}`);
          return "frame";
        },
        mark: (_frame, label) => calls.push(`mark:${label}`),
        end: () => calls.push("end")
      },
      callbacks: {
        update: (dt) => calls.push(`update:${dt}`),
        camera: () => calls.push("camera"),
        debug: () => calls.push("debug"),
        multiplayer: () => calls.push("multiplayer"),
        lighting: () => calls.push("lighting"),
        render: () => calls.push("render")
      }
    });

    expect(service.step(250)).toBe(0.1);
    expect(calls).toEqual([
      "begin:250",
      "update:0.1",
      "mark:update",
      "camera",
      "mark:camera",
      "debug",
      "mark:debug",
      "multiplayer",
      "mark:multiplayer",
      "lighting",
      "mark:lighting",
      "render",
      "mark:render",
      "end"
    ]);
  });
});
