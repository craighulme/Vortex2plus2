import { describe, expect, it } from "vitest";
import { SlimService } from "../optimization/SlimService";

describe("SlimService", () => {
  it("switches source, impostor, and culled representations by distance", () => {
    const slim = new SlimService();
    const source = { visible: false };
    const impostor = { visible: false };
    const camera = { position: { x: 0, y: 0, z: 0 } };
    const runtime = { renderer: { getHandles: () => ({ camera }) } };

    slim.registerTarget({
      id: "test",
      source,
      impostor,
      center: { x: 10, y: 0, z: 0 },
      distances: { source: 20, composite: 40, impostor: 80, cull: 120 }
    });
    slim.update(runtime, true);
    expect(source.visible).toBe(true);
    expect(impostor.visible).toBe(false);
    expect(slim.getBand("test")).toBe("source");

    camera.position.x = -70;
    slim.update(runtime, true);
    expect(source.visible).toBe(false);
    expect(impostor.visible).toBe(true);
    expect(slim.getBand("test")).toBe("impostor");

    camera.position.x = -200;
    slim.update(runtime, true);
    expect(source.visible).toBe(false);
    expect(impostor.visible).toBe(false);
    expect(slim.getBand("test")).toBe("culled");
  });
});
