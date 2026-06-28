import type { BridgeConfig, LaunchIdentity, PlatformBridge } from "../../platform/PlatformBridge";
import type { MultiplayerService, RelayHelloAvatar } from "../MultiplayerService";
import type { SocketLike, MultiplayerSessionService } from "./MultiplayerSessionService";

type ChatSink = {
  system(message: string): void;
};

type Logger = Pick<Console, "warn">;

export type MultiplayerConnectionContext = {
  config: BridgeConfig;
  currentLaunchInfo: LaunchIdentity | null;
  setLaunchInfo(info: LaunchIdentity): void;
  fallbackGameId?: number;
  fetcher: typeof fetch;
  cryptoRef: Pick<Crypto, "getRandomValues">;
  createWebSocket(url: string): SocketLike;
  handleMessage(message: unknown): void;
  handleNativePacket(buffer: ArrayBuffer): void;
  encodeHeartbeat(): ArrayBuffer;
  chat: ChatSink;
  logger?: Logger;
  joinAvatarOverride(): RelayHelloAvatar | null;
  applyJoinAvatarToLaunchInfo(avatar: RelayHelloAvatar | null): RelayHelloAvatar | null;
  hasAvatarSpoofAccess(): boolean;
  syncPacketDebugAccess(): void;
  scheduleReconnect(label: string): void;
};

export class MultiplayerConnectionService {
  constructor(
    private readonly multiplayer: MultiplayerService,
    private readonly session: MultiplayerSessionService,
    private readonly platform: PlatformBridge
  ) {}

  connect(context: MultiplayerConnectionContext): Promise<unknown> | undefined {
    return this.session.runConnect(
      () => this.connectOnce(context),
      (socket) => this.multiplayer.isSocketConnecting(socket) || this.multiplayer.isSocketOpen(socket)
    );
  }

  async connectOnce(context: MultiplayerConnectionContext): Promise<void> {
    const config = context.config;
    const plan = this.multiplayer.planBridgeConnection(config);

    if (plan.blockedLocalRelay) {
      context.chat.system("Vortex Web multiplayer is offline: local relay is disabled in this build.");
      this.session.connectFinished = true;
      return;
    }

    if (!config.launchToken && !plan.brokeredRelay) {
      context.chat.system("Vortex Web multiplayer is offline: missing launch token.");
      return;
    }

    const launchInfo = await this.resolveLaunchInfo(context, plan.localRelay, plan.hostedRelay);
    context.syncPacketDebugAccess();

    if (!launchInfo) {
      context.chat.system("Vortex Web multiplayer auth failed: missing launch identity.");
      this.session.connectFinished = true;
      return;
    }

    if (config.hubUrl) {
      this.attachHubSocket(context, launchInfo, plan.localRelay, plan.brokeredRelay);
      this.session.connectFinished = true;
      return;
    }

    this.handleLocalInit(context, launchInfo);
    this.attachNativeSocketIfAvailable(context, launchInfo);
  }

  private async resolveLaunchInfo(context: MultiplayerConnectionContext, localRelay: boolean, hostedRelay: boolean): Promise<LaunchIdentity | null> {
    if (context.currentLaunchInfo) {
      this.session.launchInfo = context.currentLaunchInfo;
      return context.currentLaunchInfo;
    }

    try {
      const launchInfo = await this.platform.resolveLaunchIdentity(context.fetcher, context.cryptoRef, {
        config: context.config,
        localRelay,
        hostedRelay,
        current: context.currentLaunchInfo,
        fallbackGameId: context.fallbackGameId || 0,
        onLocalFallback: (error) => context.logger?.warn("[mp] verify-launch failed; using browser page identity for local relay", error)
      });
      if (launchInfo) {
        this.session.launchInfo = launchInfo;
        context.setLaunchInfo(launchInfo);
      }
      return launchInfo;
    } catch (error) {
      if (!context.currentLaunchInfo) {
        context.chat.system(`Vortex Web multiplayer auth failed: ${errorMessage(error)}`);
        this.session.connectFinished = true;
        return null;
      }
      this.session.launchInfo = context.currentLaunchInfo;
      return context.currentLaunchInfo;
    }
  }

  private attachHubSocket(
    context: MultiplayerConnectionContext,
    launchInfo: LaunchIdentity,
    localRelay: boolean,
    brokeredRelay: boolean
  ): void {
    const hubUrl = this.multiplayer.buildHubUrl(context.config, launchInfo, localRelay, context.fallbackGameId || 0);
    try {
      context.chat.system(`Vortex Web connecting relay: ${new URL(hubUrl).host}`);
    } catch {
      // Keep connection setup resilient if URL parsing fails in older browser contexts.
    }

    const socket = brokeredRelay
      ? this.multiplayer.createBrokeredSocket(hubUrl) as unknown as SocketLike
      : context.createWebSocket(hubUrl);

    this.session.attachHubSocket(socket, {
      onOpen: () => {
        try {
          context.chat.system("Vortex Web relay connected.");
        } catch {
          // Chat is not critical to establishing multiplayer.
        }
        this.session.clearRetry();
        this.multiplayer.resetReconnect();
        const joinAvatar = context.hasAvatarSpoofAccess()
          ? context.applyJoinAvatarToLaunchInfo(context.joinAvatarOverride())
          : null;
        this.session.sendJson(this.multiplayer.createRelayHello({
          launchInfo,
          config: context.config,
          localRelay,
          brokeredRelay,
          fallbackGameId: context.fallbackGameId || 0,
          avatarOverride: joinAvatar
        }));
      },
      onMessage: context.handleMessage,
      onBadMessage: (error, data) => context.logger?.warn("[mp] bad hub message", error, data),
      onClose: () => context.scheduleReconnect("relay"),
      onError: () => {
        try {
          context.chat.system("Vortex Web hub connection failed.");
        } catch {
          // Chat is not critical to error handling.
        }
      }
    });
  }

  private handleLocalInit(context: MultiplayerConnectionContext, launchInfo: LaunchIdentity): void {
    context.handleMessage({
      type: "init",
      id: launchInfo.id,
      username: launchInfo.username,
      is_staff: false,
      is_booster: false,
      shirt_id: launchInfo.shirtId,
      pant_id: launchInfo.pantId,
      body_type: launchInfo.bodyType,
      body_colors: launchInfo.bodyColors,
      face_id: launchInfo.faceId,
      players: []
    });
  }

  private attachNativeSocketIfAvailable(context: MultiplayerConnectionContext, launchInfo: LaunchIdentity): void {
    if (!launchInfo.wsEndpoint) {
      context.chat.system("Vortex Web multiplayer is offline: set a browser multiplayer hub URL in the extension popup. The live app no longer exposes a browser WebSocket endpoint, and Chrome extensions cannot connect to UDP/raw TCP game sockets.");
      this.session.connectFinished = true;
      return;
    }

    const socket = context.createWebSocket(launchInfo.wsEndpoint);
    this.session.attachNativeSocket(socket, {
      onOpen: () => {
        this.session.clearRetry();
        this.multiplayer.resetReconnect();
        if (/^[a-fA-F0-9]{64}$/.test(String(launchInfo.clientToken || ""))) {
          socket.send(context.encodeHeartbeat());
        }
      },
      onNativePacket: context.handleNativePacket,
      onJsonMessage: context.handleMessage,
      onBadMessage: (error, data) => context.logger?.warn("[mp] bad multiplayer message", error, data),
      onClose: () => context.scheduleReconnect("multiplayer websocket"),
      onError: () => {
        try {
          context.chat.system("Vortex Web multiplayer websocket connection failed.");
        } catch {
          // Chat is not critical to error handling.
        }
      }
    });
    this.session.connectFinished = true;
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || "unknown error");
}
