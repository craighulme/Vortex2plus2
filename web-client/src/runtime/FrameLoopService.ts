export type FrameProfiler = {
  begin(now: number): unknown;
  mark(frame: unknown, label: string): void;
  end(frame: unknown): void;
};

export type FrameLoopCallbacks = {
  update(dt: number): void;
  camera(dt: number): void;
  debug(dt: number): void;
  multiplayer(dt: number): void;
  lighting(dt: number): void;
  render(dt: number): void;
};

export type FrameLoopOptions = {
  windowRef: Pick<Window, "requestAnimationFrame">;
  profiler: FrameProfiler;
  callbacks: FrameLoopCallbacks;
  maxDt?: number;
  now?: () => number;
};

export class FrameLoopService {
  private options: FrameLoopOptions | null = null;
  private lastTime = 0;
  private running = false;

  start(options: FrameLoopOptions): void {
    this.options = options;
    this.lastTime = options.now?.() ?? performance.now();
    if (this.running) return;
    this.running = true;
    this.schedule();
  }

  step(now: number): number {
    const options = this.assertConfigured();
    const dt = Math.min((now - this.lastTime) / 1000, options.maxDt ?? 0.1);
    this.lastTime = now;
    const frame = options.profiler.begin(now);
    options.callbacks.update(dt);
    options.profiler.mark(frame, "update");
    options.callbacks.camera(dt);
    options.profiler.mark(frame, "camera");
    options.callbacks.debug(dt);
    options.profiler.mark(frame, "debug");
    options.callbacks.multiplayer(dt);
    options.profiler.mark(frame, "multiplayer");
    options.callbacks.lighting(dt);
    options.profiler.mark(frame, "lighting");
    options.callbacks.render(dt);
    options.profiler.mark(frame, "render");
    options.profiler.end(frame);
    return dt;
  }

  private schedule(): void {
    this.assertConfigured().windowRef.requestAnimationFrame((now) => {
      this.schedule();
      this.step(now);
    });
  }

  private assertConfigured(): FrameLoopOptions {
    if (!this.options) throw new Error("FrameLoopService is not configured");
    return this.options;
  }
}
