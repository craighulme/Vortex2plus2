import { createVortexRuntime } from "./runtime/createRuntime";
import { installCompatibilityShim } from "./runtime/compatibility";

declare const __V22_RUNTIME_VERSION__: string;

declare global {
  interface Window {
    VortexRuntime?: ReturnType<typeof createVortexRuntime>;
    __v22Runtime?: ReturnType<typeof createVortexRuntime>;
    VortexRuntimeDevTools?: {
      enable(): boolean;
      disable(): boolean;
      active(): boolean;
    };
  }
}

(() => {
  if (window.__v22Runtime) return;
  if (window.localStorage.getItem("v22RuntimeDisabled") === "1") {
    window.dispatchEvent(new CustomEvent("v22-runtime-disabled"));
    return;
  }

  const runtime = createVortexRuntime({
    version: __V22_RUNTIME_VERSION__,
    document,
    window,
    location
  });

  installCompatibilityShim(window, runtime);
  installRuntimeDevTools(runtime);
  runtime.diagnostics.info("runtime.boot", {
    version: runtime.version,
    protocolVersion: runtime.protocol.version
  });
  window.dispatchEvent(new CustomEvent("v22-runtime-ready", { detail: runtime }));
})();

function installRuntimeDevTools(runtime: ReturnType<typeof createVortexRuntime>): void {
  let active = false;
  let mounted = false;
  let timer: number | null = null;

  const clearTimer = () => {
    if (timer === null) return;
    window.clearTimeout(timer);
    timer = null;
  };

  const tick = () => {
    if (!active) return;
    runtime.slim.update(runtime);
    runtime.sandbox.update(runtime);
    runtime.ui.updateRuntimePanel(runtime);

    const uiVisible = runtime.ui.snapshot().runtimePanelVisible;
    const needsFrameLoop = uiVisible || runtime.sandbox.isActive() || runtime.slim.hasTargets();
    if (needsFrameLoop) {
      requestAnimationFrame(tick);
    } else {
      timer = window.setTimeout(tick, 250);
    }
  };

  window.VortexRuntimeDevTools = {
    enable() {
      if (!mounted) {
        runtime.ui.mountRuntimePanel(runtime);
        mounted = true;
      }
      runtime.ui.setRuntimePanelVisible(true);
      if (!active) {
        active = true;
        clearTimer();
        requestAnimationFrame(tick);
      }
      return active;
    },
    disable() {
      active = false;
      clearTimer();
      runtime.ui.setRuntimePanelVisible(false);
      runtime.sandbox.stopStress();
      return true;
    },
    active() {
      return active;
    }
  };

  document.addEventListener("keydown", (event) => {
    if (event.code !== "F9") return;
    event.preventDefault();
    if (!mounted || !active || !runtime.ui.snapshot().runtimePanelVisible) {
      window.VortexRuntimeDevTools?.enable();
    } else {
      window.VortexRuntimeDevTools?.disable();
    }
  }, true);

  window.addEventListener("beforeunload", () => {
    active = false;
    clearTimer();
  }, { once: true });

  if (window.localStorage.getItem("v22RuntimeDevTools") === "1") {
    window.VortexRuntimeDevTools.enable();
  }
}
