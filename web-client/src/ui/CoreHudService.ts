import type { SlimTarget } from "../optimization/SlimService";

export type CoreHudState = {
  toolbarVisible: boolean;
  debugVisible: boolean;
  runtimePanelVisible: boolean;
};

type RuntimePanelSource = {
  version: string;
  physics: { backend: string };
  renderer: {
    getHandles(): { renderer?: unknown; scene?: unknown; camera?: unknown };
    snapshot?(): {
      attached: boolean;
      pixelRatio: number | null;
      webgl2: boolean | null;
      maxTextureSize: number | null;
      maxTextureUnits: number | null;
      maxAnisotropy: number | null;
      drawCalls: number | null;
      triangles: number | null;
      geometries: number | null;
      textures: number | null;
      shadowsEnabled: boolean | null;
    };
  };
  world: {
    getLegacyHandles(): {
      getObjects?: unknown;
      getColliders?: unknown;
    };
  };
  input: {
    snapshot(): { locked: boolean; gameFocused: boolean; targetAttached: boolean; pauseVisible: boolean; pressed: string[] };
  };
  avatar: { getPreviewState?(): unknown };
  sandbox: {
    spawnFootball(source: RuntimePanelSource): boolean;
    spawnStressField(source: RuntimePanelSource, count?: number): boolean;
    startStress(source: RuntimePanelSource, rate?: number): boolean;
    stopStress(): void;
    clear(source: RuntimePanelSource): void;
    stats(): { balls: number; stressBodies: number; stressRunning: boolean; stressRate: number; stressCapacity: number };
  };
  slim: {
    registerTarget?(target: SlimTarget): void;
    unregisterTarget?(id: string): void;
    snapshot(): { profile: string; targets: number; bands: Record<"source" | "composite" | "impostor" | "culled", number> };
  };
  streaming: {
    snapshot(): { total: number; queued: number; ready: number; rejected: number };
  };
  community: {
    snapshot(): { ownUserId: number | null; cachedProfiles: number };
  };
  legacy: { getVortex(): unknown };
  diagnostics: { warn(event: string, payload?: Record<string, unknown>): void };
};

export class CoreHudService {
  private state: CoreHudState = {
    toolbarVisible: true,
    debugVisible: false,
    runtimePanelVisible: false
  };
  private runtimePanel: HTMLElement | null = null;
  private runtimePanelBody: HTMLElement | null = null;
  private frameCount = 0;
  private lastFpsAt = performance.now();
  private lastPanelRenderAt = 0;
  private fps = 0;

  constructor(private readonly document: Document) {}

  setToolbarVisible(visible: boolean): void {
    this.state = { ...this.state, toolbarVisible: visible };
    this.document.dispatchEvent(new CustomEvent("v22-ui-toolbar", { detail: { visible } }));
  }

  setDebugVisible(visible: boolean): void {
    this.state = { ...this.state, debugVisible: visible };
    this.document.dispatchEvent(new CustomEvent("v22-ui-debug", { detail: { visible } }));
  }

  setRuntimePanelVisible(visible: boolean): void {
    this.state = { ...this.state, runtimePanelVisible: visible };
    if (this.runtimePanel) this.runtimePanel.hidden = !visible;
  }

  mountRuntimePanel(source: RuntimePanelSource): void {
    if (this.runtimePanel) return;
    this.ensureRuntimePanelStyle();
    const panel = this.document.createElement("div");
    panel.id = "vortex-runtime-panel";
    panel.innerHTML = `
      <div class="vrp-head">
        <span>Vortex Web</span>
        <button type="button" title="Hide runtime panel">F9</button>
      </div>
      <div class="vrp-body"></div>
      <div class="vrp-actions">
        <button type="button" data-vrp-action="football">Ball</button>
        <button type="button" data-vrp-action="stress">Start Stress</button>
        <button type="button" data-vrp-action="stop">Stop</button>
        <button type="button" data-vrp-action="clear">Clear</button>
      </div>
    `;
    this.runtimePanel = panel;
    this.runtimePanelBody = panel.querySelector(".vrp-body");
    panel.querySelector("button")?.addEventListener("click", () => this.setRuntimePanelVisible(false));
    panel.querySelector("[data-vrp-action='football']")?.addEventListener("click", () => source.sandbox.spawnFootball(source));
    panel.querySelector("[data-vrp-action='stress']")?.addEventListener("click", () => source.sandbox.startStress(source, 250));
    panel.querySelector("[data-vrp-action='stop']")?.addEventListener("click", () => source.sandbox.stopStress());
    panel.querySelector("[data-vrp-action='clear']")?.addEventListener("click", () => source.sandbox.clear(source));
    this.document.body.appendChild(panel);
    this.setRuntimePanelVisible(this.state.runtimePanelVisible);

    this.updateRuntimePanel(source);
  }

  updateRuntimePanel(source: RuntimePanelSource): void {
    if (!this.runtimePanelBody || !this.state.runtimePanelVisible) return;
    this.frameCount += 1;
    const now = performance.now();
    if (now - this.lastFpsAt >= 500) {
      this.fps = Math.round((this.frameCount * 1000) / Math.max(1, now - this.lastFpsAt));
      this.frameCount = 0;
      this.lastFpsAt = now;
    }
    if (now - this.lastPanelRenderAt < 500) return;
    this.lastPanelRenderAt = now;

    const rendererHandles = source.renderer.getHandles();
    const worldHandles = source.world.getLegacyHandles();
    const objects = callArrayGetter(worldHandles.getObjects);
    const colliders = callArrayGetter(worldHandles.getColliders);
    const avatar = source.avatar.getPreviewState?.();
    const sandbox = source.sandbox.stats();
    const slim = source.slim.snapshot();
    const input = source.input.snapshot();
    const streaming = source.streaming.snapshot();
    const renderer = source.renderer.snapshot?.();
    this.runtimePanelBody.innerHTML = `
      <div><b>Client</b><span>live web runtime</span></div>
      <div><b>Version</b><span>${escapeHtml(source.version)}</span></div>
      <div><b>Input</b><span>${escapeHtml(formatInput(input))}</span></div>
      <div><b>Physics</b><span>${escapeHtml(formatPhysics(source.physics.backend))}</span></div>
      <div><b>SLIM</b><span>${escapeHtml(formatSlim(slim))}</span></div>
      <div><b>Stream</b><span>${escapeHtml(formatStream(streaming))}</span></div>
      <div><b>Renderer</b><span>${escapeHtml(formatRenderer(renderer, Boolean(rendererHandles.renderer)))}</span></div>
      <div><b>World</b><span>${objects.length} objects / ${colliders.length} colliders</span></div>
      <div><b>FPS</b><span>${this.fps || "-"}</span></div>
      <div><b>Sandbox</b><span>${escapeHtml(formatSandbox(sandbox))}</span></div>
      <div><b>Avatar</b><span>${escapeHtml(formatAvatar(avatar))}</span></div>
    `;
  }

  snapshot(): CoreHudState {
    return { ...this.state };
  }

  private ensureRuntimePanelStyle(): void {
    if (this.document.getElementById("vortex-runtime-panel-style")) return;
    const style = this.document.createElement("style");
    style.id = "vortex-runtime-panel-style";
    style.textContent = `
      #vortex-runtime-panel {
        position: fixed;
        right: 12px;
        bottom: 12px;
        z-index: 2147483000;
        width: min(340px, calc(100vw - 24px));
        color: #f8fafc;
        background: rgba(8, 12, 20, 0.82);
        border: 1px solid rgba(148, 163, 184, 0.28);
        border-radius: 8px;
        box-shadow: 0 12px 26px rgba(0,0,0,0.28);
        font: 12px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        pointer-events: auto;
        overflow: hidden;
      }
      #vortex-runtime-panel .vrp-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 8px 10px;
        background: rgba(37, 99, 235, 0.32);
        font-weight: 800;
      }
      #vortex-runtime-panel button {
        border: 0;
        border-radius: 5px;
        padding: 3px 7px;
        color: #fff;
        background: rgba(255,255,255,0.13);
        font: inherit;
        font-weight: 800;
        cursor: pointer;
      }
      #vortex-runtime-panel .vrp-body {
        display: grid;
        gap: 4px;
        padding: 9px 10px 10px;
      }
      #vortex-runtime-panel .vrp-actions {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 6px;
        padding: 0 10px 10px;
      }
      #vortex-runtime-panel .vrp-actions button {
        min-width: 0;
        padding: 4px 6px;
      }
      #vortex-runtime-panel .vrp-body div {
        display: grid;
        grid-template-columns: 72px 1fr;
        gap: 8px;
      }
      #vortex-runtime-panel b {
        color: #93c5fd;
      }
      #vortex-runtime-panel span {
        color: rgba(248,250,252,0.88);
        min-width: 0;
        overflow-wrap: anywhere;
      }
    `;
    this.document.documentElement.appendChild(style);
  }
}

function callArrayGetter(getter: unknown): unknown[] {
  if (typeof getter !== "function") return [];
  try {
    const value = getter();
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function formatAvatar(value: unknown): string {
  if (!value || typeof value !== "object") return "default";
  const avatar = value as Record<string, unknown>;
  return `shirt ${avatar.shirtId ?? 0}, pants ${avatar.pantId ?? 0}, face ${avatar.faceId ?? 0}`;
}

function formatPhysics(backend: string): string {
  if (backend === "legacy-adapter") return "client sandbox + live world";
  return backend;
}

function formatInput(input: { locked: boolean; gameFocused: boolean; targetAttached: boolean; pauseVisible: boolean; pressed: string[] }): string {
  if (!input.targetAttached) return "waiting for canvas";
  if (input.locked) return `${input.pressed.length} keys, locked`;
  return input.pauseVisible ? "cursor visible" : input.gameFocused ? "focused" : "idle";
}

function formatSandbox(sandbox: { balls: number; stressBodies: number; stressRunning: boolean; stressRate: number; stressCapacity: number }): string {
  const parts = [`${sandbox.balls} ball${sandbox.balls === 1 ? "" : "s"}`];
  if (sandbox.stressBodies) {
    parts.push(`${sandbox.stressBodies}/${sandbox.stressCapacity} bricks`);
  }
  if (sandbox.stressRunning) {
    parts.push(`${sandbox.stressRate}/sec`);
  }
  return parts.join(", ");
}

function formatStream(streaming: { total: number; queued: number; ready: number; rejected: number }): string {
  if (!streaming.total) return "no remote assets";
  return `${streaming.ready} ready, ${streaming.queued} queued, ${streaming.rejected} rejected`;
}

function formatRenderer(
  renderer: ReturnType<NonNullable<RuntimePanelSource["renderer"]["snapshot"]>> | undefined,
  attached: boolean
): string {
  if (!attached) return "pending";
  if (!renderer) return "attached";
  const api = renderer.webgl2 ? "WebGL2" : renderer.webgl2 === false ? "WebGL1" : "WebGL";
  const calls = renderer.drawCalls ?? "-";
  const tris = renderer.triangles ?? "-";
  const textures = renderer.textures ?? "-";
  return `${api}, ${renderer.pixelRatio ?? "-"}x, ${calls} calls, ${tris} tris, ${textures} tex`;
}

function formatSlim(slim: { profile: string; targets: number; bands: Record<"source" | "composite" | "impostor" | "culled", number> }): string {
  if (!slim.targets) return `${slim.profile}, no targets`;
  return `${slim.profile}, ${slim.bands.source}/${slim.bands.composite}/${slim.bands.impostor}/${slim.bands.culled}`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
