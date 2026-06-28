type RendererLike = {
  userData?: Record<string, unknown>;
  info?: {
    render?: Record<string, unknown>;
    memory?: Record<string, unknown>;
    programs?: unknown[];
  };
};

type PerformanceFrame = {
  frameStart: number;
  mark: number;
  rafNow: number;
};

type PerformanceConfig = {
  renderer?: RendererLike;
  detectRendererBackend?: (renderer: RendererLike) => string;
  readQuality?: () => unknown;
};

type PerformanceReport = {
  frames: number;
  sections: Record<string, number>;
  cadence: {
    samples: number;
    avgRafMs: number;
    estimatedPresentedFps: number;
    minRafMs: number;
    maxRafMs: number;
    longFramesOver34ms: number;
  };
  renderer: Record<string, unknown>;
  quality: unknown;
};

function readStorageFlag(windowRef: Window, key: string, fallback = false): boolean {
  const value = windowRef.localStorage.getItem(key);
  if (value === null) return fallback;
  return value === "1" || value === "yes" || value === "true" || value === "on";
}

function numberFrom(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export class PerformanceService {
  enabled: boolean;
  log = false;
  frames = 0;
  totals: Record<string, number> = Object.create(null);
  lastReport: PerformanceReport | null = null;
  lastRafAt: number | null = null;
  rafSamples = 0;
  rafTotal = 0;
  rafMin = Infinity;
  rafMax = 0;
  rafLongFrames = 0;

  private renderer: RendererLike | null = null;
  private detectRendererBackend: (renderer: RendererLike) => string = () => "unknown";
  private readQuality: () => unknown = () => null;

  constructor(private readonly windowRef: Window) {
    this.enabled = readStorageFlag(windowRef, "vwebPerf", false);
  }

  configure(config: PerformanceConfig): this {
    if (config.renderer) this.renderer = config.renderer;
    if (config.detectRendererBackend) this.detectRendererBackend = config.detectRendererBackend;
    if (config.readQuality) this.readQuality = config.readQuality;
    return this;
  }

  reset(clearLastReport = false): void {
    this.frames = 0;
    this.totals = Object.create(null);
    this.lastRafAt = null;
    this.rafSamples = 0;
    this.rafTotal = 0;
    this.rafMin = Infinity;
    this.rafMax = 0;
    this.rafLongFrames = 0;
    if (clearLastReport) this.lastReport = null;
  }

  setEnabled(value: boolean): boolean {
    this.enabled = !!value;
    this.windowRef.localStorage.setItem("vwebPerf", this.enabled ? "1" : "0");
    this.reset(true);
    return this.enabled;
  }

  setLog(value: boolean): boolean {
    this.log = !!value;
    return this.log;
  }

  stop(): true {
    this.enabled = false;
    this.log = false;
    this.windowRef.localStorage.setItem("vwebPerf", "0");
    this.windowRef.localStorage.removeItem("vwebPerfLog");
    this.reset(true);
    return true;
  }

  begin(now: number): PerformanceFrame | null {
    if (!this.enabled) return null;
    if (this.lastRafAt !== null && Number.isFinite(now)) {
      const rafDt = Math.max(0, now - this.lastRafAt);
      this.rafSamples++;
      this.rafTotal += rafDt;
      this.rafMin = Math.min(this.rafMin, rafDt);
      this.rafMax = Math.max(this.rafMax, rafDt);
      if (rafDt > 34) this.rafLongFrames++;
    }
    if (Number.isFinite(now)) this.lastRafAt = now;
    const start = this.windowRef.performance.now();
    return { frameStart: start, mark: start, rafNow: now };
  }

  mark(frame: PerformanceFrame | null, name: string): void {
    if (!frame) return;
    const now = this.windowRef.performance.now();
    this.totals[name] = (this.totals[name] || 0) + (now - frame.mark);
    frame.mark = now;
  }

  end(frame: PerformanceFrame | null): void {
    if (!frame) return;
    const now = this.windowRef.performance.now();
    this.totals.frame = (this.totals.frame || 0) + (now - frame.frameStart);
    this.frames++;
    if (this.frames >= 180) {
      this.lastReport = this.report();
      if (this.log) {
        console.table(this.lastReport.sections);
        console.table(this.lastReport.cadence);
        console.table(this.lastReport.renderer);
      }
      this.reset();
    }
  }

  report(): PerformanceReport {
    if (this.frames === 0 && this.lastReport) return this.lastReport;
    const frames = Math.max(1, this.frames);
    const sections: Record<string, number> = {};
    for (const [name, value] of Object.entries(this.totals)) {
      sections[name] = Number((value / frames).toFixed(3));
    }
    const avgRafMs = this.rafSamples ? this.rafTotal / this.rafSamples : 0;

    return {
      frames: this.frames,
      sections,
      cadence: {
        samples: this.rafSamples,
        avgRafMs: Number(avgRafMs.toFixed(3)),
        estimatedPresentedFps: avgRafMs > 0 ? Number((1000 / avgRafMs).toFixed(1)) : 0,
        minRafMs: Number((Number.isFinite(this.rafMin) ? this.rafMin : 0).toFixed(3)),
        maxRafMs: Number(this.rafMax.toFixed(3)),
        longFramesOver34ms: this.rafLongFrames
      },
      renderer: this.rendererSnapshot(),
      quality: this.readQuality()
    };
  }

  sample(seconds = 5, options: { log?: boolean } = {}): Promise<PerformanceReport> {
    const previousEnabled = this.enabled;
    const previousLog = this.log;
    this.enabled = true;
    this.log = !!options.log;
    this.windowRef.localStorage.setItem("vwebPerf", "1");
    this.reset(true);
    const duration = Math.max(1, Math.min(30, Number(seconds) || 5)) * 1000;
    return new Promise((resolve) => {
      this.windowRef.setTimeout(() => {
        const report = this.report();
        this.enabled = previousEnabled;
        this.log = previousLog;
        this.windowRef.localStorage.setItem("vwebPerf", this.enabled ? "1" : "0");
        if (!this.enabled) this.reset(true);
        resolve(report);
      }, duration);
    });
  }

  private rendererSnapshot(): Record<string, unknown> {
    const renderer = this.renderer;
    const render = renderer?.info?.render || {};
    const memory = renderer?.info?.memory || {};
    return {
      backend: renderer ? renderer.userData?.vwebBackend || this.detectRendererBackend(renderer) : "unknown",
      calls: numberFrom(render.drawCalls ?? render.calls),
      renderCalls: numberFrom(render.frameCalls ?? render.calls),
      triangles: numberFrom(render.triangles),
      points: numberFrom(render.points),
      lines: numberFrom(render.lines),
      geometries: numberFrom(memory.geometries),
      textures: numberFrom(memory.textures),
      programs: Array.isArray(renderer?.info?.programs) ? renderer.info.programs.length : 0
    };
  }
}
