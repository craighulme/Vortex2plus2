import { AssetManager } from "../assets/AssetManager";
import { AnimationService } from "../animation/AnimationService";
import { AvatarService } from "../avatar/AvatarService";
import { CommunityProfileService } from "../community/CommunityProfileService";
import { DiagnosticsService } from "../diagnostics/DiagnosticsService";
import { GameSession } from "../game/GameSession";
import { InputService } from "../input/InputService";
import { MultiplayerService } from "../network/MultiplayerService";
import { createProtocolService } from "../network/protocol";
import { SlimService } from "../optimization/SlimService";
import { createPhysicsWorld } from "../physics/createPhysicsWorld";
import { PlatformBridge } from "../platform/PlatformBridge";
import { RendererService } from "../renderer/RendererService";
import { ClientPhysicsSandbox } from "../sandbox/ClientPhysicsSandbox";
import { ScriptRuntime } from "../scripting/ScriptRuntime";
import { AssetStreamService } from "../streaming/AssetStreamService";
import { ChatService } from "../ui/ChatService";
import { CoreHudService } from "../ui/CoreHudService";
import { LeaderboardService } from "../ui/LeaderboardService";
import { SettingsMenuService } from "../ui/SettingsMenuService";
import { WorldService } from "../world/WorldService";
import { EventBus } from "./EventBus";
import type { PhysicsBackend } from "../physics/types";
import type { RuntimeEventMap, RuntimeOptions, VortexRuntime } from "./types";

export function createVortexRuntime(options: RuntimeOptions): VortexRuntime {
  const events = new EventBus<RuntimeEventMap>();
  const diagnostics = new DiagnosticsService();
  const platform = new PlatformBridge(options.document, options.location);
  const gameSession = new GameSession(platform.bridgeConfig, events);
  let legacyVortex: unknown = null;
  let physicsSyncTimer: number | null = null;
  const animation = new AnimationService();
  animation.setFootIk({ enabled: false });

  const runtime: VortexRuntime = {
    version: options.version,
    platform,
    events,
    assets: new AssetManager(platform.assetManifest, diagnostics),
    renderer: new RendererService(),
    world: new WorldService(),
    input: new InputService(options.document, options.window),
    gameSession,
    physics: createPhysicsWorld({ backend: readPhysicsBackend(options.window), diagnostics }),
    avatar: new AvatarService(),
    animation,
    scripting: new ScriptRuntime(events, diagnostics),
    sandbox: new ClientPhysicsSandbox(),
    slim: new SlimService(),
    multiplayer: new MultiplayerService(),
    protocol: createProtocolService(),
    ui: new CoreHudService(options.document),
    chat: new ChatService(options.document, options.window),
    leaderboard: new LeaderboardService(),
    settingsMenu: new SettingsMenuService(options.document),
    diagnostics,
    community: new CommunityProfileService(),
    streaming: new AssetStreamService(diagnostics),
    legacy: {
      getVortex: () => legacyVortex,
      setVortex(value: unknown) {
        legacyVortex = value;
        attachLegacyRuntimeHandles(runtime, value);
        startPhysicsSync(runtime, options.window, () => legacyVortex, physicsSyncTimer, (timer) => {
          physicsSyncTimer = timer;
        });
        events.emit("legacy:vortex-ready", { legacy: value });
      }
    }
  };

  options.window.addEventListener("beforeunload", () => {
    if (physicsSyncTimer !== null) options.window.clearInterval(physicsSyncTimer);
    physicsSyncTimer = null;
    runtime.physics.dispose();
  }, { once: true });

  return runtime;
}

function readPhysicsBackend(windowRef: Window): PhysicsBackend {
  return windowRef.localStorage.getItem("v22PhysicsBackend") === "legacy" ? "legacy" : "rapier";
}

function startPhysicsSync(
  runtime: VortexRuntime,
  windowRef: Window,
  readLegacy: () => unknown,
  currentTimer: number | null,
  setTimer: (timer: number | null) => void
): void {
  if (!runtime.physics.syncStaticCollidersFromLegacy) return;
  const sync = () => {
    const legacy = readLegacy();
    const getColliders = legacy && typeof legacy === "object" ? (legacy as { getColliders?: unknown }).getColliders : null;
    if (typeof getColliders !== "function") return;
    try {
      const colliders = getColliders();
      if (Array.isArray(colliders)) runtime.physics.syncStaticCollidersFromLegacy?.(colliders);
    } catch (error) {
      runtime.diagnostics.warn("physics.sync.failed", { error: error instanceof Error ? error.message : String(error) });
    }
  };
  sync();
  for (const delay of [250, 1000, 2500, 5000]) {
    windowRef.setTimeout(sync, delay);
  }
  if (currentTimer === null) {
    setTimer(windowRef.setInterval(sync, 2000));
  }
}

function attachLegacyRuntimeHandles(runtime: VortexRuntime, legacy: unknown): void {
  if (!legacy || typeof legacy !== "object") return;
  const api = legacy as Record<string, unknown>;

  const rendererHandles: Parameters<VortexRuntime["renderer"]["attachLegacy"]>[0] = {};
  if (api.scene) rendererHandles.scene = api.scene;
  if (typeof api.getCamera === "function") rendererHandles.camera = api.getCamera();
  const globalRenderer = (globalThis as typeof globalThis & { renderer?: unknown }).renderer;
  if (globalRenderer) rendererHandles.renderer = globalRenderer;
  runtime.renderer.attachLegacy(rendererHandles);
  const domElement = readRendererDomElement(globalRenderer);
  if (domElement) runtime.input.attachTarget(domElement);

  runtime.world.attachLegacy({
    addPart: api.addPart,
    removePart: api.removePart,
    pick: api.pick,
    getObjects: api.getObjects,
    getColliders: api.getColliders
  });

  runtime.avatar.attachLegacy({
    applyAvatar: api.applyAvatar,
    getAvatar: api.getAvatar,
    setAvatarRenderer: api.setAvatarRenderer,
    getAvatarRenderer: api.getAvatarRenderer
  });
}

function readRendererDomElement(renderer: unknown): HTMLElement | null {
  if (!renderer || typeof renderer !== "object") return null;
  const domElement = (renderer as { domElement?: unknown }).domElement;
  return domElement instanceof HTMLElement ? domElement : null;
}
