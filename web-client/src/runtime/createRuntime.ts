import { AssetManager } from "../assets/AssetManager";
import { RuntimeAssetResolverService } from "../assets/RuntimeAssetResolverService";
import { TextureService } from "../assets/TextureService";
import { AnimationService } from "../animation/AnimationService";
import { AudioService } from "../audio/AudioService";
import { CameraService } from "../camera/CameraService";
import { AvatarMaterialService } from "../avatar/AvatarMaterialService";
import { AvatarAssetService } from "../avatar/AvatarAssetService";
import { CharacterSpawnService } from "../avatar/CharacterSpawnService";
import { EngineAvatarRuntimeService } from "../avatar/EngineAvatarRuntimeService";
import { LocalAvatarService } from "../avatar/LocalAvatarService";
import { AvatarService } from "../avatar/AvatarService";
import { RemoteAvatarAppearanceService } from "../avatar/RemoteAvatarAppearanceService";
import { RemotePlayerService } from "../avatar/RemotePlayerService";
import { RemoteSessionService } from "../avatar/RemoteSessionService";
import { CommunityProfileService } from "../community/CommunityProfileService";
import { DebugVisualService } from "../diagnostics/DebugVisualService";
import { DiagnosticsService } from "../diagnostics/DiagnosticsService";
import { PerformanceService } from "../diagnostics/PerformanceService";
import { GameSession } from "../game/GameSession";
import { CursorService } from "../input/CursorService";
import { EngineInputRuntimeService } from "../input/EngineInputRuntimeService";
import { InputService } from "../input/InputService";
import { CharacterCollisionService } from "../movement/CharacterCollisionService";
import { ClimbService } from "../movement/ClimbService";
import { EngineLocalPlayerRuntimeService } from "../movement/EngineLocalPlayerRuntimeService";
import { LocalMovementRuntimeService } from "../movement/LocalMovementRuntimeService";
import { MovementService } from "../movement/MovementService";
import { MultiplayerService } from "../network/MultiplayerService";
import { MultiplayerBridgeService } from "../network/bridge/MultiplayerBridgeService";
import { MultiplayerConnectionService } from "../network/relay/MultiplayerConnectionService";
import { MultiplayerMessageRouter } from "../network/relay/MultiplayerMessageRouter";
import { MultiplayerSessionService } from "../network/relay/MultiplayerSessionService";
import { PacketDebugService } from "../network/PacketDebugService";
import { createProtocolService } from "../network/protocol";
import { SlimService } from "../optimization/SlimService";
import { createPhysicsWorld } from "../physics/createPhysicsWorld";
import { AccessService } from "../platform/AccessService";
import { PlatformBridge } from "../platform/PlatformBridge";
import { QualityService } from "../renderer/QualityService";
import { RendererService } from "../renderer/RendererService";
import { SceneSettingsService } from "../renderer/SceneSettingsService";
import { ShadowRuntimeService } from "../renderer/ShadowRuntimeService";
import { ClientPhysicsSandbox } from "../sandbox/ClientPhysicsSandbox";
import { ScriptRuntime } from "../scripting/ScriptRuntime";
import { AssetStreamService } from "../streaming/AssetStreamService";
import { ChatCommandService } from "../ui/ChatCommandService";
import { ChatService } from "../ui/ChatService";
import { ChatBubbleService } from "../ui/ChatBubbleService";
import { CoreHudService } from "../ui/CoreHudService";
import { EngineHudRuntimeService } from "../ui/EngineHudRuntimeService";
import { HudInteractionService } from "../ui/HudInteractionService";
import { LeaderboardService } from "../ui/LeaderboardService";
import { LeaderboardDomService } from "../ui/LeaderboardDomService";
import { NotificationService } from "../ui/NotificationService";
import { RuntimeSettingsPresenterService } from "../ui/RuntimeSettingsPresenter";
import { SettingsMenuService } from "../ui/SettingsMenuService";
import { EngineWorldRuntimeService } from "../world/EngineWorldRuntimeService";
import { WorldBootstrapService } from "../world/WorldBootstrapService";
import { WorldService } from "../world/WorldService";
import { WorldColliderService } from "../world/WorldColliderService";
import { WorldGeometryService } from "../world/WorldGeometryService";
import { WorldMaterialService } from "../world/WorldMaterialService";
import { WorldPartService } from "../world/WorldPartService";
import { WorldPickingService } from "../world/WorldPickingService";
import { WorldRuntimeService } from "../world/WorldRuntimeService";
import { EventBus } from "./EventBus";
import { EngineCompatibilityService } from "./EngineCompatibilityService";
import { EngineRuntimeBridgeService } from "./EngineRuntimeBridgeService";
import { EngineSceneRuntimeService } from "./EngineSceneRuntimeService";
import { FrameLoopService } from "./FrameLoopService";
import { LoadingScreenService } from "./LoadingScreenService";
import { RuntimeSettingsStore } from "./RuntimeSettingsStore";
import type { PhysicsBackend } from "../physics/types";
import type { RuntimeEventMap, RuntimeOptions, VortexRuntime } from "./types";

export function createVortexRuntime(options: RuntimeOptions): VortexRuntime {
  const events = new EventBus<RuntimeEventMap>();
  const diagnostics = new DiagnosticsService();
  const platform = new PlatformBridge(options.document, options.location);
  const gameSession = new GameSession(platform.bridgeConfig, events);
  const notifications = new NotificationService(options.document, options.window).installGlobal();
  const audio = new AudioService(options.window, options.document);
  const input = new InputService(options.document, options.window);
  const settingsMenu = new SettingsMenuService(options.document);
  let vortexApi: unknown = null;
  let physicsSyncTimer: number | null = null;
  const animation = new AnimationService();
  const multiplayer = new MultiplayerService();
  const multiplayerSession = new MultiplayerSessionService();
  animation.setFootIk({ enabled: false });

  const runtime: VortexRuntime = {
    version: options.version,
    access: new AccessService(),
    platform,
    events,
    engineCompatibility: new EngineCompatibilityService(),
    engineRuntimeBridge: new EngineRuntimeBridgeService(),
    engineScene: new EngineSceneRuntimeService(),
    frameLoop: new FrameLoopService(),
    loading: new LoadingScreenService(options.document),
    settingsStore: new RuntimeSettingsStore(options.window.localStorage),
    assets: new AssetManager(platform.assetManifest, diagnostics),
    assetResolver: new RuntimeAssetResolverService(),
    textures: new TextureService(options.window),
    audio,
    camera: new CameraService(),
    renderer: new RendererService(),
    sceneSettings: new SceneSettingsService(),
    shadowRuntime: new ShadowRuntimeService(),
    engineWorld: new EngineWorldRuntimeService(),
    world: new WorldService(),
    worldBootstrap: new WorldBootstrapService(options.document, options.window, options.location),
    worldColliders: new WorldColliderService(),
    worldGeometry: new WorldGeometryService(),
    worldMaterials: new WorldMaterialService(),
    worldParts: new WorldPartService(),
    worldPicking: new WorldPickingService(),
    worldRuntime: new WorldRuntimeService(),
    cursor: new CursorService(options.window),
    engineInput: new EngineInputRuntimeService(),
    input,
    characterCollision: new CharacterCollisionService(),
    climb: new ClimbService(),
    engineLocalPlayer: new EngineLocalPlayerRuntimeService(),
    localMovement: new LocalMovementRuntimeService(),
    movement: new MovementService(),
    gameSession,
    physics: createPhysicsWorld({ backend: readPhysicsBackend(options.window), diagnostics }),
    avatarMaterials: new AvatarMaterialService(),
    avatarAssets: new AvatarAssetService(options.window),
    avatar: new AvatarService(),
    engineAvatar: new EngineAvatarRuntimeService(),
    characterSpawn: new CharacterSpawnService(),
    localAvatar: new LocalAvatarService(),
    remoteAvatarAppearance: new RemoteAvatarAppearanceService(),
    remotePlayers: new RemotePlayerService(),
    remoteSession: new RemoteSessionService(),
    animation,
    scripting: new ScriptRuntime(events, diagnostics),
    sandbox: new ClientPhysicsSandbox(),
    slim: new SlimService(),
    multiplayer,
    multiplayerConnection: new MultiplayerConnectionService(multiplayer, multiplayerSession, platform),
    multiplayerBridge: new MultiplayerBridgeService(options.window, options.document),
    multiplayerRouter: new MultiplayerMessageRouter(),
    multiplayerSession,
    packetDebug: new PacketDebugService(options.window.localStorage),
    protocol: createProtocolService(),
    ui: new CoreHudService(options.document),
    engineHud: new EngineHudRuntimeService(),
    hudInteractions: new HudInteractionService(options.document),
    chatCommands: new ChatCommandService(),
    chat: new ChatService(options.document, options.window),
    chatBubbles: new ChatBubbleService(),
    leaderboard: new LeaderboardService(),
    leaderboardDom: new LeaderboardDomService(),
    notifications,
    runtimeSettings: new RuntimeSettingsPresenterService({
      document: options.document,
      windowRef: options.window,
      localStorage: options.window.localStorage,
      input,
      audio,
      menu: settingsMenu
    }),
    settingsMenu,
    debugVisuals: new DebugVisualService(),
    diagnostics,
    perf: new PerformanceService(options.window),
    community: new CommunityProfileService(options.window),
    streaming: new AssetStreamService(diagnostics),
    quality: new QualityService(),
    vortex: {
      get: () => vortexApi,
      set(value: unknown) {
        vortexApi = value;
        attachVortexRuntimeHandles(runtime, value);
        startPhysicsSync(runtime, options.window, () => vortexApi, physicsSyncTimer, (timer) => {
          physicsSyncTimer = timer;
        });
        events.emit("vortex:ready", { vortex: value });
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
  if (windowRef.localStorage.getItem("vwebRapierEnabled") === "1") return "rapier";
  return "legacy";
}

function startPhysicsSync(
  runtime: VortexRuntime,
  windowRef: Window,
  readVortex: () => unknown,
  currentTimer: number | null,
  setTimer: (timer: number | null) => void
): void {
  if (runtime.physics.backend !== "rapier") return;
  if (!runtime.physics.syncStaticCollidersFromLegacy) return;
  const sync = () => {
    const vortex = readVortex();
    const getColliders = vortex && typeof vortex === "object" ? (vortex as { getColliders?: unknown }).getColliders : null;
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

function attachVortexRuntimeHandles(runtime: VortexRuntime, vortex: unknown): void {
  if (!vortex || typeof vortex !== "object") return;
  const api = vortex as Record<string, unknown>;

  const rendererHandles: Parameters<VortexRuntime["renderer"]["attachLegacy"]>[0] = {};
  if (api.scene) rendererHandles.scene = api.scene;
  if (typeof api.getCamera === "function") rendererHandles.camera = api.getCamera();
  const globalRenderer = (globalThis as typeof globalThis & { renderer?: unknown }).renderer;
  if (globalRenderer) rendererHandles.renderer = globalRenderer;
  runtime.renderer.attachLegacy(rendererHandles);
  const domElement = readRendererDomElement(globalRenderer);
  if (domElement) runtime.input.attachTarget(domElement);

  runtime.world.attachLegacy({
    pick: api.pick,
    getObjects: api.getObjects,
    getColliders: api.getColliders
  });

  runtime.avatar.attachLegacy({
    applyAvatar: api.applyAvatar,
    getAvatar: api.getAvatar
  });
}

function readRendererDomElement(renderer: unknown): HTMLElement | null {
  if (!renderer || typeof renderer !== "object") return null;
  const domElement = (renderer as { domElement?: unknown }).domElement;
  return domElement instanceof HTMLElement ? domElement : null;
}
