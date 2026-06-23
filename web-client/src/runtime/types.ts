import type { AssetManager } from "../assets/AssetManager";
import type { AnimationService } from "../animation/AnimationService";
import type { AvatarService } from "../avatar/AvatarService";
import type { CommunityProfileService } from "../community/CommunityProfileService";
import type { DiagnosticsService } from "../diagnostics/DiagnosticsService";
import type { GameSession } from "../game/GameSession";
import type { InputService } from "../input/InputService";
import type { ProtocolService } from "../network/protocol";
import type { SlimService } from "../optimization/SlimService";
import type { PhysicsWorld } from "../physics/types";
import type { ScriptRuntime } from "../scripting/ScriptRuntime";
import type { ClientPhysicsSandbox } from "../sandbox/ClientPhysicsSandbox";
import type { CoreHudService } from "../ui/CoreHudService";
import type { SettingsMenuService } from "../ui/SettingsMenuService";
import type { EventBus } from "./EventBus";
import type { PlatformBridge } from "../platform/PlatformBridge";
import type { RendererService } from "../renderer/RendererService";
import type { AssetStreamService } from "../streaming/AssetStreamService";
import type { WorldService } from "../world/WorldService";

export type RuntimeEventMap = {
  "legacy:vortex-ready": { legacy: unknown };
  "session:changed": { snapshot: unknown };
  "script:package-rejected": { reason: string };
};

export type VortexRuntime = {
  version: string;
  platform: PlatformBridge;
  events: EventBus<RuntimeEventMap>;
  assets: AssetManager;
  renderer: RendererService;
  world: WorldService;
  input: InputService;
  gameSession: GameSession;
  physics: PhysicsWorld;
  avatar: AvatarService;
  animation: AnimationService;
  scripting: ScriptRuntime;
  sandbox: ClientPhysicsSandbox;
  slim: SlimService;
  protocol: ProtocolService;
  ui: CoreHudService;
  settingsMenu: SettingsMenuService;
  diagnostics: DiagnosticsService;
  community: CommunityProfileService;
  streaming: AssetStreamService;
  legacy: {
    getVortex(): unknown;
    setVortex(value: unknown): void;
  };
};

export type RuntimeOptions = {
  version: string;
  document: Document;
  window: Window;
  location: Location;
};
