import type { VortexRuntime } from "./types";

type VortexWindow = Window & {
  VortexRuntime?: VortexRuntime;
  __vwebRuntime?: VortexRuntime;
  _vortex?: unknown;
};

export function installCompatibilityShim(target: Window, runtime: VortexRuntime): void {
  const win = target as VortexWindow;
  win.VortexRuntime = runtime;
  win.__vwebRuntime = runtime;

  const existing = Object.getOwnPropertyDescriptor(win, "_vortex");
  if (existing && existing.configurable === false) {
    runtime.vortex.set(win._vortex ?? null);
    return;
  }

  let vortexValue: unknown = win._vortex ?? null;
  runtime.vortex.set(vortexValue);

  Object.defineProperty(win, "_vortex", {
    configurable: true,
    enumerable: true,
    get() {
      return vortexValue;
    },
    set(value: unknown) {
      vortexValue = value;
      runtime.vortex.set(value);
    }
  });
}
