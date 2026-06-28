import { describe, expect, it } from "vitest";
import { PerformanceService } from "../diagnostics/PerformanceService";

function makeWindow() {
  const values = new Map<string, string>();
  let now = 0;
  return {
    localStorage: {
      getItem(key: string) {
        return values.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        values.set(key, value);
      },
      removeItem(key: string) {
        values.delete(key);
      }
    },
    performance: {
      now() {
        now += 2;
        return now;
      }
    },
    setTimeout(callback: () => void) {
      callback();
      return 1;
    }
  } as unknown as Window;
}

describe("PerformanceService", () => {
  it("keeps the legacy profiler API while reporting renderer and cadence stats", () => {
    const windowRef = makeWindow();
    const perf = new PerformanceService(windowRef).configure({
      renderer: {
        userData: { vwebBackend: "webgpu" },
        info: {
          render: { drawCalls: 7, frameCalls: 5, triangles: 123 },
          memory: { geometries: 3, textures: 2 },
          programs: ["program-a", "program-b"]
        }
      },
      readQuality: () => ({ shadows: false })
    });

    expect(perf.setEnabled(true)).toBe(true);
    const frame = perf.begin(100);
    perf.mark(frame, "update");
    perf.mark(frame, "render");
    perf.end(frame);

    const next = perf.begin(116.7);
    perf.end(next);

    expect(perf.report()).toMatchObject({
      frames: 2,
      cadence: {
        samples: 1,
        estimatedPresentedFps: 59.9
      },
      renderer: {
        backend: "webgpu",
        calls: 7,
        renderCalls: 5,
        triangles: 123,
        geometries: 3,
        textures: 2,
        programs: 2
      },
      quality: { shadows: false }
    });
  });

  it("samples temporarily without leaving profiling enabled when it was off", async () => {
    const windowRef = makeWindow();
    const perf = new PerformanceService(windowRef);

    const report = await perf.sample(1);

    expect(report.frames).toBe(0);
    expect(perf.enabled).toBe(false);
  });
});
