import { createMultiplayerAccessBridge } from "./MultiplayerAccessBridge";
import { resolveMultiplayerBridgeDependencies } from "./MultiplayerBridgeDependencies";
import { createMultiplayerAvatarSpoofBridge } from "./MultiplayerAvatarSpoofBridge";
import { createMultiplayerBubbleBridge } from "./MultiplayerBubbleBridge";
import { createMultiplayerBroadcastBridge } from "./MultiplayerBroadcastBridge";
import { createMultiplayerConnectionBridge } from "./MultiplayerConnectionBridge";
import { createMultiplayerCoordinateBridge } from "./MultiplayerCoordinateBridge";
import { installMultiplayerConsoleBridge } from "./MultiplayerConsoleBridge";
import { installMultiplayerDebugConsole } from "./MultiplayerDebugConsoleBridge";
import { installMultiplayerFrameBridge } from "./MultiplayerFrameBridge";
import { createMultiplayerRemoteAvatarBridge } from "./MultiplayerRemoteAvatarBridge";
import { createMultiplayerRemoteBridge } from "./MultiplayerRemoteBridge";
import { createMultiplayerRuntimeServices } from "./MultiplayerRuntimeServices";
import { handleMultiplayerBridgeMessage } from "./MultiplayerRouterBridgeContext";
import { createMultiplayerLaunchState } from "./MultiplayerLaunchState";
import { createMultiplayerProfileBridge } from "./MultiplayerProfileBridge";
import { createMultiplayerReconnectBridge } from "./MultiplayerReconnectBridge";
import type { RuntimeApi } from "../../runtime/RuntimeApiExportService";

export class MultiplayerBridgeService {
  private mounted = false;
  private frameBridge: { updateFrame?: (dt: number) => void } | null = null;
  private runtimeApi: RuntimeApi | null = null;

  constructor(
    private readonly windowRef: Window,
    private readonly documentRef: Document
  ) {}

  setRuntimeApi(api: RuntimeApi) {
    this.runtimeApi = api;
  }

  mount(runtime: any): boolean {
    if (this.mounted) return false;

    const resolved = resolveMultiplayerBridgeDependencies(this.windowRef, this.documentRef, this.runtimeApi);
    if (!resolved.ok) return false;
    const {
      window,
      document,
      localStorage,
      setTimeout,
      setInterval,
      clearInterval,
      fetch,
      crypto,
      WebSocket,
      location,
      THREE,
      Chat,
      runtimeApi,
      scene
    } = resolved.deps;
    const runtimeServices = runtime;
    const services = createMultiplayerRuntimeServices(runtimeServices);
    window.VortexRuntime = runtimeServices;
    this.mounted = true;

    function _hasRuntimeApi() {
        return !!runtimeApi;
    }
    
    function _queueUntilRuntimeApi(message: unknown) {
        return _runtimeMultiplayer().queueUntilRuntimeApiReady(message, _hasRuntimeApi());
    }
    
    function _flushPendingRuntimeApiMessages() {
        _runtimeMultiplayer().flushQueuedRuntimeApiMessages(_hasRuntimeApi, handle);
    }
    
    window.addEventListener("vweb-runtime-exports-ready", _flushPendingRuntimeApiMessages);
    window.addEventListener("vweb-runtime-ready", () => setTimeout(_flushPendingRuntimeApiMessages, 0));
    
    function _normalizeAvatarFields(data: Record<string, any> = {}) {
        return services.normalizeAvatarFields(data);
    }
    
    const launchState = createMultiplayerLaunchState();
    
    function _statusFor(id: unknown) {
        return _runtimeMultiplayer().friendStatus(id);
    }
    
    function _runtimeMultiplayer() {
        return services.multiplayer();
    }
    
    function _runtimeSession() {
        return services.session();
    }
    
    function _runtimeConnection() {
        return services.connection();
    }
    
    function _runtimeRouter() {
        return services.router();
    }
    
    function _runtimeRemoteSession() {
        return services.remoteSession();
    }
    
    function _runtimeAccess() {
        return services.access();
    }

    function _runtimeCommunity() {
        return services.community();
    }
    
    function _leaderboard() {
        return services.leaderboard();
    }
    const coordinateBridge = createMultiplayerCoordinateBridge({
        runtimeApi,
        runtimeMultiplayer: _runtimeMultiplayer
    });

    const {
        nativeFootOffset: _nativeFootOffset,
        sceneFootOffset: _sceneFootOffset,
        nativeYToSceneY: _nativeYToSceneY,
        sceneYToNativeY: _sceneYToNativeY
    } = coordinateBridge;

    const bubbleBridge = createMultiplayerBubbleBridge({
        THREE,
        document,
        window,
        runtimeApi,
        chatBubbles: runtimeServices.chatBubbles,
        runtimeRemoteSession: _runtimeRemoteSession
    });

    const remoteAvatarBridge = createMultiplayerRemoteAvatarBridge({
        THREE,
        document,
        runtimeApi,
        remotePlayers: runtimeServices.remotePlayers,
        animation: runtimeServices.animation
    });

    const profileBridge = createMultiplayerProfileBridge({
        fetch,
        community: _runtimeCommunity,
        runtimeMultiplayer: _runtimeMultiplayer,
        runtimeRemoteSession: _runtimeRemoteSession,
        leaderboard: _leaderboard,
        setRemoteNameLabel: remoteAvatarBridge.setNameLabel
    });
    
    function getBridgeConfig() {
        return services.bridgeConfig();
    }

    let connectionBridge: any = null;
    let broadcastBridge: any = null;
    
    function bridgeOpen() {
        return connectionBridge ? connectionBridge.isOpen() : _runtimeMultiplayer().isSocketOpen(_runtimeSession().socket);
    }
    
    let _skipNextRemoteAvatarRebuild = false;
    
    function _runtimePacketDebug() {
        return services.packetDebug();
    }
    
    function _recordReplicatedPlayers(source: unknown, players: unknown) {
        return _runtimePacketDebug().recordReplicatedPlayers(source, players, {
            fallbackGameId: window.GAME_ID || 0,
            normalizeAvatar: _normalizeAvatarFields,
            log: console
        });
    }
    
    function _avatarSignature(avatar: unknown) {
        return _runtimePacketDebug().avatarSignature(avatar, _normalizeAvatarFields);
    }
    
    function _recordProbeEvent(event: unknown) {
        return _runtimePacketDebug().recordProbeEvent(event, console);
    }

    const remoteBridge = createMultiplayerRemoteBridge({
        THREE,
        runtimeApi,
        fetch,
        localStorage,
        console,
        runtimeMultiplayer: _runtimeMultiplayer,
        runtimeRemoteSession: _runtimeRemoteSession,
        runtimePacketDebug: _runtimePacketDebug,
        community: _runtimeCommunity,
        normalizeAvatarFields: _normalizeAvatarFields,
        avatarSignature: _avatarSignature,
        nativeYToSceneY: _nativeYToSceneY,
        playerDisplayName: profileBridge.playerDisplayName,
        makeRemote: remoteAvatarBridge.make,
        setRemoteNameLabel: remoteAvatarBridge.setNameLabel,
        disposeRemote: remoteAvatarBridge.dispose,
        clearBubble: bubbleBridge.clear,
        leaderboard: _leaderboard,
        statusFor: _statusFor
    });

    const accessBridge = createMultiplayerAccessBridge({
        localStorage,
        Chat,
        runtimeAccess: _runtimeAccess,
        runtimePacketDebug: _runtimePacketDebug,
        runtimeMultiplayer: _runtimeMultiplayer,
        getBridgeConfig,
        getLaunchInfo: launchState.getLaunchInfo
    });
    
    const avatarSpoof = createMultiplayerAvatarSpoofBridge({
        localStorage,
        console,
        setTimeout,
        normalizeAvatarFields: _normalizeAvatarFields,
        hasAvatarSpoofAccess: accessBridge.hasAvatarSpoofAccess,
        runtimePacketDebug: _runtimePacketDebug,
        runtimeSession: _runtimeSession,
        runtimeMultiplayer: _runtimeMultiplayer,
        runtimeApi,
        bridgeOpen,
        bridgeSend,
        sceneFootOffset: _sceneFootOffset,
        sceneYToNativeY: _sceneYToNativeY,
        getLaunchInfo: launchState.getLaunchInfo,
        updateLaunchAvatar: launchState.updateLaunchAvatar,
        setSkipNextRemoteAvatarRebuild(value: unknown) {
            _skipNextRemoteAvatarRebuild = !!value;
        }
    });

    const reconnectBridge = createMultiplayerReconnectBridge({
        Chat,
        setTimeout,
        stopBroadcast: () => broadcastBridge?.stop?.(),
        runtimeSession: _runtimeSession,
        runtimeMultiplayer: _runtimeMultiplayer,
        connect
    });

    connectionBridge = createMultiplayerConnectionBridge({
        window,
        fetch,
        crypto,
        WebSocket,
        Chat,
        console,
        runtimeSession: _runtimeSession,
        runtimeMultiplayer: _runtimeMultiplayer,
        runtimeConnection: _runtimeConnection,
        runtimeRemoteSession: _runtimeRemoteSession,
        getBridgeConfig,
        getLaunchInfo: launchState.getLaunchInfo,
        setLaunchInfo: launchState.setLaunchInfo,
        getSelfId: launchState.getSelfId,
        getFallbackGameId: () => window.GAME_ID || 0,
        handleMessage: handle,
        scheduleReconnect: reconnectBridge.scheduleReconnect,
        protocol: () => runtimeServices.protocol,
        avatarSpoof,
        accessBridge
    });
    
    function _sendProbe(options: Record<string, any> = {}) {
        accessBridge.assertPacketDebugAccess();
        if (!_runtimeSession().hubMode || !bridgeOpen()) throw new Error("probe requires the local relay connection");
        const probeCase = String(options.case || options.probe || "append_tail");
        const payload = { ...options, type: "probe_packet", case: probeCase };
        _runtimeSession().sendJson(payload);
        return _recordProbeEvent({ type: "probe_requested", case: probeCase, payload });
    }
    
    installMultiplayerDebugConsole({
        window,
        console,
        runtime: runtimeServices,
        setTimeout,
        setInterval,
        clearInterval,
        assertPacketDebugAccess: accessBridge.assertPacketDebugAccess,
        runtimePacketDebug: _runtimePacketDebug,
        runtimeMultiplayer: _runtimeMultiplayer,
        remoteDebugRows: remoteBridge.remoteDebugRows,
        nativeFootOffset: _nativeFootOffset,
        sceneFootOffset: _sceneFootOffset,
        getRemoteYOffset: remoteBridge.getRemoteYOffset,
        setRemoteYOffset: remoteBridge.setRemoteYOffset,
        setJoinAvatarOverride: avatarSpoof.setJoinAvatarOverride,
        joinAvatarOverride: avatarSpoof.joinAvatarOverride,
        clearJoinAvatarOverride: avatarSpoof.clearJoinAvatarOverride,
        setOutboundAvatar: avatarSpoof.setOutboundAvatar,
        spoofAvatarResync: avatarSpoof.spoofAvatarResync,
        spoofAvatarDropResync: avatarSpoof.spoofAvatarDropResync,
        spoofAvatarReset: avatarSpoof.spoofAvatarReset,
        spoofAvatarRejoin: avatarSpoof.spoofAvatarRejoin,
        setMovementFormat: avatarSpoof.setMovementFormat,
        bridgeOpen,
        bridgeSend,
        sendProbe: _sendProbe,
        currentLaunchAvatar: avatarSpoof.currentLaunchAvatar
    });

    function bridgeSend(payload: unknown) {
        return connectionBridge.send(payload);
    }
    
    async function connect() {
        return connectionBridge.connect();
    }
    
    function encodeNetworkData(data: unknown) {
        return connectionBridge.encodeNetworkData(data);
    }

    broadcastBridge = createMultiplayerBroadcastBridge({
        window,
        setInterval,
        clearInterval,
        runtimeApi,
        runtimeSession: _runtimeSession,
        runtimeMultiplayer: _runtimeMultiplayer,
        sceneYToNativeY: _sceneYToNativeY,
        bridgeOpen,
        encodeNetworkData,
        bridgeSend
    });
    
    function handle(d: Record<string, any>) {
        handleMultiplayerBridgeMessage(d, {
            window,
            Chat,
            runtimeApi,
            queueUntilRuntimeApi: _queueUntilRuntimeApi,
            runtimeRouter: _runtimeRouter,
            runtimeSession: _runtimeSession,
            runtimeRemoteSession: _runtimeRemoteSession,
            runtimeMultiplayer: _runtimeMultiplayer,
            runtimePacketDebug: _runtimePacketDebug,
            remoteBridge,
            getSelfId: launchState.getSelfId,
            setSelfId: launchState.setSelfId,
            getLaunchInfo: launchState.getLaunchInfo,
            setLaunchInfo: launchState.setLaunchInfo,
            playerDisplayName: profileBridge.playerDisplayName,
            applyKnownPlayerName: profileBridge.applyKnownPlayerName,
            recordReplicatedPlayers: _recordReplicatedPlayers,
            recordProbeEvent: _recordProbeEvent,
            normalizeAvatarFields: _normalizeAvatarFields,
            leaderboard: _leaderboard,
            fetchFriendData: profileBridge.fetchFriendData,
            startBroadcast: broadcastBridge.start,
            showBubble: bubbleBridge.show
        });
    }
    
    window._mpSetFriendStatus = function (id: unknown, status: unknown) {
        const next = _runtimeMultiplayer().setFriendStatus(id, status);
        _leaderboard().setFriendStatus(id, next);
    };
    this.frameBridge = installMultiplayerFrameBridge({
        window,
        runtimeApi,
        runtimeRemoteSession: _runtimeRemoteSession,
        remotePlayerService: remoteAvatarBridge.service,
        normalizeAvatarFields: _normalizeAvatarFields,
        playerDisplayName: profileBridge.playerDisplayName,
        noteRemoteState: remoteBridge.noteRemoteState,
        animateRemote: remoteAvatarBridge.animate,
        hasBubbles: bubbleBridge.hasBubbles,
        updateBubblePositions: () => bubbleBridge.updatePositions(launchState.getSelfId()),
        shouldSkipAvatarRebuild: () => _skipNextRemoteAvatarRebuild,
        clearSkipAvatarRebuild: () => {
            _skipNextRemoteAvatarRebuild = false;
        }
    });
    
    const consoleBridge = installMultiplayerConsoleBridge({
        window,
        fetch,
        Chat,
        chatCommands: runtimeServices.chatCommands,
        avatar: runtimeServices.avatar,
        avatarAssets: runtimeServices.avatarAssets,
        avatarMaterials: runtimeServices.avatarMaterials,
        remotePlayers: runtimeServices.remotePlayers,
        remoteSession: runtimeServices.remoteSession,
        packetDebug: runtimeServices.packetDebug,
        runtimeApi,
        runtimeRemoteSession: _runtimeRemoteSession,
        normalizeAvatarFields: _normalizeAvatarFields,
        requireLicenseFeature: accessBridge.requireLicenseFeature,
        assertLicenseFeature: accessBridge.assertLicenseFeature,
        getLaunchInfo: launchState.getLaunchInfo,
        getLocalPlayerId: launchState.getSelfId,
        setLaunchInfoAvatar: launchState.updateLaunchAvatar
    });
    runtimeServices.chat?.configureOutbound?.({
        handleCommand: consoleBridge.handleChatCommand,
        sendMessage: (msg: unknown) => bridgeSend({ type: "chat", msg })
    });
    
    connect();
    return true;
  }

  updateFrame(dt: number) {
    this.frameBridge?.updateFrame?.(dt);
  }
}
