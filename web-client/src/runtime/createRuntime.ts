import { AssetManager } from "../assets/AssetManager";
import { RuntimeAssetResolverService } from "../assets/RuntimeAssetResolverService";
import { TextureService } from "../assets/TextureService";
import { AnimationService } from "../animation/AnimationService";
import { AudioService } from "../audio/AudioService";
import { CameraService } from "../camera/CameraService";
import { AvatarMaterialService } from "../avatar/materials/AvatarMaterialService";
import { AvatarEquipmentService } from "../avatar/AvatarEquipmentService";
import { AvatarAssetService } from "../avatar/AvatarAssetService";
import { CharacterSpawnService } from "../avatar/CharacterSpawnService";
import { AvatarRuntimeSetupService } from "../avatar/AvatarRuntimeSetupService";
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
import { InputRuntimeSetupService } from "../input/InputRuntimeSetupService";
import { InputService } from "../input/InputService";
import { CharacterCollisionService } from "../movement/CharacterCollisionService";
import { ClimbService } from "../movement/ClimbService";
import { LocalPlayerRuntimeSetupService } from "../movement/LocalPlayerRuntimeSetupService";
import { LocalMovementRuntimeService } from "../movement/LocalMovementRuntimeService";
import { MovementService } from "../movement/MovementService";
import { PlayerService } from "../players/PlayerService";
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
import { HudRuntimeSetupService } from "../ui/HudRuntimeSetupService";
import { HudInteractionService } from "../ui/HudInteractionService";
import { LeaderboardService } from "../ui/LeaderboardService";
import { LeaderboardDomService } from "../ui/LeaderboardDomService";
import { NotificationService } from "../ui/NotificationService";
import { RuntimeSettingsPresenterService } from "../ui/RuntimeSettingsPresenter";
import { SettingsMenuService } from "../ui/SettingsMenuService";
import { ThemeService } from "../ui/ThemeService";
import { WorldRuntimeSetupService } from "../world/WorldRuntimeSetupService";
import { WorldBootstrapService } from "../world/WorldBootstrapService";
import { WorldService } from "../world/WorldService";
import { WorldColliderService } from "../world/WorldColliderService";
import { WorldDynamicObjectService } from "../world/WorldDynamicObjectService";
import { WorldGeometryService } from "../world/WorldGeometryService";
import { WorldMaterialService } from "../world/WorldMaterialService";
import { WorldPartService } from "../world/WorldPartService";
import { WorldPickingService } from "../world/WorldPickingService";
import { WorldRuntimeService } from "../world/WorldRuntimeService";
import { EventBus } from "./EventBus";
import { RuntimeApiExportService } from "./RuntimeApiExportService";
import type { RuntimeApi } from "./RuntimeApiExportService";
import { RuntimeStartupService } from "./RuntimeStartupService";
import { SceneRuntimeSetupService } from "./SceneRuntimeSetupService";
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
  const theme = new ThemeService(options.document, options.window.localStorage).installGlobal(options.window as Window & Record<string, unknown>);
  let physicsSyncTimer: number | null = null;
  const animation = new AnimationService();
  const multiplayer = new MultiplayerService();
  const multiplayerSession = new MultiplayerSessionService();
  const remoteSession = new RemoteSessionService();
  const players = new PlayerService();
  players.attachRemoteSession(remoteSession);
  animation.setFootIk({ enabled: false });

  const runtime: VortexRuntime = {
    version: options.version,
    access: new AccessService(),
    platform,
    events,
    runtimeApiExports: new RuntimeApiExportService(),
    runtimeStartup: new RuntimeStartupService(),
    sceneSetup: new SceneRuntimeSetupService(),
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
    worldBridge: new WorldRuntimeSetupService(),
    world: new WorldService(),
    worldBootstrap: new WorldBootstrapService(options.document, options.window, options.location),
    worldColliders: new WorldColliderService(),
    worldGeometry: new WorldGeometryService(),
    worldMaterials: new WorldMaterialService(),
    worldParts: new WorldPartService(),
    worldPicking: new WorldPickingService(),
    worldRuntime: new WorldRuntimeService(),
    worldDynamicObjects: new WorldDynamicObjectService(),
    cursor: new CursorService(options.window),
    inputSetup: new InputRuntimeSetupService(),
    input,
    characterCollision: new CharacterCollisionService(),
    climb: new ClimbService(),
    localPlayerSetup: new LocalPlayerRuntimeSetupService(),
    localMovement: new LocalMovementRuntimeService(),
    movement: new MovementService(),
    players,
    gameSession,
    physics: createPhysicsWorld({ backend: readPhysicsBackend(options.window), diagnostics }),
    avatarMaterials: new AvatarMaterialService(),
    avatarAssets: new AvatarAssetService(options.window),
    avatarEquipment: new AvatarEquipmentService(),
    avatar: new AvatarService(),
    avatarSetup: new AvatarRuntimeSetupService(),
    characterSpawn: new CharacterSpawnService(),
    localAvatar: new LocalAvatarService(),
    remoteAvatarAppearance: new RemoteAvatarAppearanceService(),
    remotePlayers: new RemotePlayerService(),
    remoteSession,
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
    hudSetup: new HudRuntimeSetupService(),
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
    theme,
    debugVisuals: new DebugVisualService(),
    diagnostics,
    perf: new PerformanceService(options.window),
    community: new CommunityProfileService(options.window),
    streaming: new AssetStreamService(diagnostics),
    quality: new QualityService()
  };

  startPhysicsSync(runtime, options.window, physicsSyncTimer, (timer) => {
    physicsSyncTimer = timer;
  });

  options.window.addEventListener("beforeunload", () => {
    if (physicsSyncTimer !== null) options.window.clearInterval(physicsSyncTimer);
    physicsSyncTimer = null;
    runtime.physics.dispose();
  }, { once: true });

  return runtime;
}

export function attachRuntimeApi(runtime: VortexRuntime, runtimeApi: RuntimeApi): void {
  const renderer = runtime.renderer.getHandles().renderer;
  const domElement = readRendererDomElement(renderer);
  if (domElement) runtime.input.attachTarget(domElement);

  runtime.avatar.attachRuntimeAdapter({
    applyAvatar: runtimeApi.applyAvatar,
    getAvatar: runtimeApi.getAvatar
  });

  runtime.multiplayerBridge.setRuntimeApi(runtimeApi);
  runtime.events.emit("runtime-api:ready", { api: runtimeApi });
}

function readPhysicsBackend(windowRef: Window): PhysicsBackend {
  if (windowRef.localStorage.getItem("vwebRapierEnabled") === "1") return "rapier";
  return "static";
}

function startPhysicsSync(
  runtime: VortexRuntime,
  windowRef: Window,
  currentTimer: number | null,
  setTimer: (timer: number | null) => void
): void {
  if (runtime.physics.backend !== "rapier") return;
  if (!runtime.physics.syncStaticColliders) return;
  const sync = () => {
    try {
      const colliders = runtime.worldColliders.colliders;
      if (Array.isArray(colliders)) runtime.physics.syncStaticColliders?.(colliders);
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

function readRendererDomElement(renderer: unknown): HTMLElement | null {
  if (!renderer || typeof renderer !== "object") return null;
  const domElement = (renderer as { domElement?: unknown }).domElement;
  return domElement instanceof HTMLElement ? domElement : null;
}
