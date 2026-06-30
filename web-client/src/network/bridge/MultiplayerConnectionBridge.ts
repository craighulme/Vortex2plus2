// @ts-nocheck

export function createMultiplayerConnectionBridge(context) {
  const {
    window,
    fetch,
    crypto,
    WebSocket,
    Chat,
    console,
    runtimeSession,
    runtimeMultiplayer,
    runtimeConnection,
    runtimeRemoteSession,
    getBridgeConfig,
    getLaunchInfo,
    setLaunchInfo,
    getSelfId,
    getFallbackGameId,
    handleMessage,
    scheduleReconnect,
    protocol,
    avatarSpoof,
    accessBridge
  } = context;

  function encodeMovementPacket(data) {
    return runtimeSession().encodeMovementPacket(protocol(), data);
  }

  function encodeHeartbeat() {
    return runtimeSession().encodeHeartbeat(protocol());
  }

  function encodeChatPacket(msg) {
    return runtimeSession().encodeChatPacket(protocol(), msg);
  }

  function handleNativePacket(buffer) {
    for (const message of protocol().nativePacketMessages(buffer, {
      selfId: getSelfId(),
      hasRemote: (id) => runtimeRemoteSession().has(id)
    })) handleMessage(message);
  }

  function send(payload) {
    return runtimeSession().sendPayload(payload, {
      encodeMovement: encodeMovementPacket,
      encodeChat: encodeChatPacket
    });
  }

  function isOpen() {
    return runtimeMultiplayer().isSocketOpen(runtimeSession().socket);
  }

  function contextForConnection() {
    return {
      config: getBridgeConfig(),
      currentLaunchInfo: getLaunchInfo(),
      setLaunchInfo(info) {
        setLaunchInfo(info);
        runtimeSession().launchInfo = info;
      },
      fallbackGameId: getFallbackGameId(),
      fetcher: fetch,
      cryptoRef: crypto,
      createWebSocket: (url) => new WebSocket(url),
      handleMessage,
      handleNativePacket,
      encodeHeartbeat,
      chat: Chat,
      logger: console,
      joinAvatarOverride: avatarSpoof.joinAvatarOverride,
      applyJoinAvatarToLaunchInfo: avatarSpoof.applyJoinAvatarToLaunchInfo,
      hasAvatarSpoofAccess: accessBridge.hasAvatarSpoofAccess,
      syncPacketDebugAccess: accessBridge.syncPacketDebugAccess,
      scheduleReconnect
    };
  }

  function connect() {
    return runtimeConnection().connect(contextForConnection());
  }

  function connectOnce() {
    return runtimeConnection().connectOnce(contextForConnection());
  }

  return {
    send,
    isOpen,
    connect,
    connectOnce,
    encodeNetworkData: (data) => runtimeMultiplayer().encodeNetworkData(data)
  };
}
