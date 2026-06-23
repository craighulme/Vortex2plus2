import { AssetManager } from "../assets/AssetManager";
import { AnimationService } from "../animation/AnimationService";
import { AvatarService } from "../avatar/AvatarService";
import { CommunityProfileService } from "../community/CommunityProfileService";
import { DiagnosticsService } from "../diagnostics/DiagnosticsService";
import { GameSession } from "../game/GameSession";
import { InputService } from "../input/InputService";
import { createProtocolService } from "../network/protocol";
import { SlimService } from "../optimization/SlimService";
import { createPhysicsWorld } from "../physics/createPhysicsWorld";
import { PlatformBridge } from "../platform/PlatformBridge";
import { RendererService } from "../renderer/RendererService";
import { ClientPhysicsSandbox } from "../sandbox/ClientPhysicsSandbox";
import { ScriptRuntime } from "../scripting/ScriptRuntime";
import { AssetStreamService } from "../streaming/AssetStreamService";
import { CoreHudService } from "../ui/CoreHudService";
import { WorldService } from "../world/WorldService";
import { EventBus } from "./EventBus";
import type { RuntimeEventMap, RuntimeOptions, VortexRuntime } from "./types";

export function createVortexRuntime(options: RuntimeOptions): VortexRuntime {
  const events = new EventBus<RuntimeEventMap>();
  const diagnostics = new DiagnosticsService();
  const platform = new PlatformBridge(options.document, options.location);
  const gameSession = new GameSession(platform.bridgeConfig, events);
  let legacyVortex: unknown = null;

  const runtime: VortexRuntime = {
    version: options.version,
    platform,
    events,
    assets: new AssetManager(platform.assetManifest, diagnostics),
    renderer: new RendererService(),
    world: new WorldService(),
    input: new InputService(options.document, options.window),
    gameSession,
    physics: createPhysicsWorld({ backend: "legacy", diagnostics }),
    avatar: new AvatarService(),
    animation: new AnimationService(),
    scripting: new ScriptRuntime(events, diagnostics),
    sandbox: new ClientPhysicsSandbox(),
    slim: new SlimService(),
    protocol: createProtocolService(),
    ui: new CoreHudService(options.document),
    diagnostics,
    community: new CommunityProfileService(),
    streaming: new AssetStreamService(diagnostics),
    legacy: {
      getVortex: () => legacyVortex,
      setVortex(value: unknown) {
        legacyVortex = value;
        attachLegacyRuntimeHandles(runtime, value);
        events.emit("legacy:vortex-ready", { legacy: value });
      }
    }
  };

  return runtime;
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
