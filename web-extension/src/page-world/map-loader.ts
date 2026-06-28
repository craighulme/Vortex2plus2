type RuntimeWithWorldBootstrap = {
  worldBootstrap?: {
    installGlobals(runtime: RuntimeWithWorldBootstrap): void;
    boot(runtime: RuntimeWithWorldBootstrap, fetcher: typeof fetch): void;
  };
};

export {};

declare global {
  interface Window {
    VortexRuntime?: RuntimeWithWorldBootstrap;
  }
}

function bootVortexWebMapLoader(): boolean {
  const runtime = window.VortexRuntime;
  if (!runtime?.worldBootstrap) return false;
  runtime.worldBootstrap.installGlobals(runtime);
  runtime.worldBootstrap.boot(runtime, fetch.bind(window));
  return true;
}

function bootWhenRuntimeReady(): void {
  if (bootVortexWebMapLoader()) return;
  window.addEventListener("vweb-runtime-ready", () => bootVortexWebMapLoader(), { once: true });
}

if (document.readyState === "loading") {
  window.addEventListener("load", bootWhenRuntimeReady, { once: true });
} else {
  bootWhenRuntimeReady();
}
