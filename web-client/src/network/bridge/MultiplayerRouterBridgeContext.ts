// @ts-nocheck

export function handleMultiplayerBridgeMessage(d, ctx) {
  if (ctx.queueUntilEngine(d)) return;
  ctx.remoteBridge.recordMultiplayerMessage(d);
  ctx.runtimeRouter().handle(d, {
    selfId: ctx.getSelfId,
    setSelfId: (id) => {
      ctx.setSelfId(id);
      ctx.runtimeRemoteSession().selfId = id;
    },
    launchInfo: ctx.getLaunchInfo,
    setLaunchInfoFromInit: (message, username) => {
      const launchInfo = {
        id: message.id,
        username,
        gameId: message.game_id || message.gameId || Number(ctx.window.GAME_ID || 0),
        shirtId: message.shirt_id || 0,
        pantId: message.pant_id || 0,
        bodyType: message.body_type || "male",
        bodyColors: message.body_colors || [],
        faceId: message.face_id || 0,
        clientToken: "",
        raw: message
      };
      ctx.setLaunchInfo(launchInfo);
      ctx.runtimeSession().launchInfo = launchInfo;
    },
    fallbackGameId: () => Number(ctx.window.GAME_ID || 0),
    displayName: ctx.playerDisplayName,
    applyKnownPlayerName: ctx.applyKnownPlayerName,
    recordPlayers: ctx.recordReplicatedPlayers,
    recordProbe: ctx.recordProbeEvent,
    recordLeave: (id, username) => ctx.runtimePacketDebug().recordLeave(id, username),
    hasRemote: (id) => ctx.runtimeRemoteSession().has(id),
    getRemote: (id) => ctx.runtimeRemoteSession().get(id),
    addRemote: ctx.remoteBridge.addRemote,
    removeRemote: ctx.remoteBridge.removeRemote,
    decodeRemoteState: ctx.remoteBridge.decodeNetworkData,
    prefetchAvatarImages: (value) => ctx.vortex.prefetchAvatarImages?.(value),
    applyLocalAvatar: (value) => ctx.vortex.applyAvatar?.(value),
    applyAvatarToRemote: (remote, data) => {
      const avatar = ctx.normalizeAvatarFields({ ...(remote.avatar || {}), ...data });
      remote.avatar = avatar;
      if (remote.meshes) {
        ctx.vortex.applyAvatarToMeshes?.(remote.meshes, {
          ...avatar,
          id: remote.id,
          playerId: remote.id,
          username: remote.username
        });
        return true;
      }
      return false;
    },
    updatePendingShirt: (id, shirtId) => {
      const pending = ctx.runtimeRemoteSession().pendingAvatars.get(id);
      if (pending) pending.shirt_id = shirtId;
    },
    setLeaderboardSelf: (id) => ctx.leaderboard().setMyId(id),
    addLeaderboardPlayer: (player) => ctx.leaderboard().addPlayer(player),
    setLeaderboardFriendStatus: (id, status) => ctx.leaderboard().setFriendStatus(id, status),
    setRuntimeFriendStatus: (id, status) => ctx.runtimeMultiplayer().setFriendStatus(id, status),
    fetchFriendData: ctx.fetchFriendData,
    startBroadcast: ctx.startBroadcast,
    kicked: () => {
      const socket = ctx.runtimeSession().socket;
      if (socket) socket._kicked = true;
      socket?.close?.();
      ctx.window.location.href = "/";
    },
    openScreen: (screenId, token) => ctx.window.openScreen?.(screenId, token),
    chat: {
      system: (message) => ctx.Chat.system(message),
      systemRed: (message) => ctx.Chat.systemRed(message),
      systemPlayer: (username, message) => ctx.Chat.systemPlayer(username, message),
      clearPlayerMsg: (username) => ctx.Chat.clearPlayerMsg(username),
      message: (username, message, self, isStaff, isOwner, isBooster) => ctx.Chat.message(username, message, self, isStaff, isOwner, isBooster),
      warn: (message) => ctx.Chat.warn(message)
    },
    bubble: ctx.showBubble,
    notifications: {
      friendRequest: (fromId, username) => ctx.window.Notifications?.friendRequest(fromId, username),
      friendRequestCancelled: (fromId) => ctx.window.Notifications?.friendRequestCancelled?.(fromId),
      friendAccepted: (username) => ctx.window.Notifications?.friendAccepted(username),
      followed: (username) => ctx.window.Notifications?.followed?.(username),
      unfollowed: (username) => ctx.window.Notifications?.unfollowed?.(username)
    }
  });
}
