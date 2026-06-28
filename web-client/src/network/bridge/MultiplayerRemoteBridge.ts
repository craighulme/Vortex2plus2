// @ts-nocheck

export function createMultiplayerRemoteBridge(context) {
  const {
    THREE,
    vortex,
    localStorage,
    console,
    runtimeMultiplayer,
    runtimeRemoteSession,
    runtimePacketDebug,
    community,
    normalizeAvatarFields,
    avatarSignature,
    nativeYToSceneY,
    playerDisplayName,
    makeRemote,
    setRemoteNameLabel,
    disposeRemote,
    clearBubble,
    leaderboard,
    statusFor
  } = context;

  const REMOTE_Y_OFFSET_STORAGE_KEY = "vwebRemoteYOffset";
  let remoteYOffset = readStoredRemoteYOffset();

  function readStoredRemoteYOffset() {
    const value = Number(localStorage?.getItem?.(REMOTE_Y_OFFSET_STORAGE_KEY) || 0);
    return Number.isFinite(value) ? clampRemoteYOffset(value) : 0;
  }

  function clampRemoteYOffset(value) {
    return Math.max(-10, Math.min(10, value));
  }

  function applyRemoteYOffsetDelta(delta) {
    if (!delta) return;
    for (const remote of runtimeRemoteSession().remotes.values()) {
      if (remote?.pos) remote.pos.y += delta;
      if (remote?.tPos) remote.tPos.y += delta;
      if (remote?.meshes?.grp?.position) remote.meshes.grp.position.y += delta;
      if (remote?.meshes?.proxy?.position) remote.meshes.proxy.position.y += delta;
    }
  }

  function setRemoteYOffset(value = 0) {
    const next = clampRemoteYOffset(Number(value) || 0);
    const delta = next - remoteYOffset;
    remoteYOffset = next;
    if (remoteYOffset) localStorage?.setItem?.(REMOTE_Y_OFFSET_STORAGE_KEY, String(remoteYOffset));
    else localStorage?.removeItem?.(REMOTE_Y_OFFSET_STORAGE_KEY);
    applyRemoteYOffsetDelta(delta);
    return remoteYOffset;
  }

  function getRemoteYOffset() {
    return remoteYOffset;
  }

  function readRemoteScenePositionResult(playerData) {
    const result = runtimeMultiplayer().readRemoteScenePosition(playerData, nativeYToSceneY);
    if (!result.state) return result;
    const pos = result.state.pos;
    const scenePos = new THREE.Vector3(pos.x, pos.y + remoteYOffset, pos.z);
    return { state: { pos: scenePos, ry: result.state.ry }, reason: "" };
  }

  function recordMultiplayerMessage(message) {
    runtimeMultiplayer().recordMessage(message, runtimePacketDebug().enabled);
  }

  function remoteDebugRows() {
    return runtimeMultiplayer().remoteDebugRows(runtimeRemoteSession().remotes);
  }

  function readRemoteScenePosition(playerData) {
    return readRemoteScenePositionResult(playerData).state;
  }

  function logBadRemoteState(playerData, reason) {
    if (!runtimePacketDebug().enabled) return;
    if (!runtimeMultiplayer().shouldLogBadRemoteState(playerData?.id)) return;
    console.warn("[mp] ignored invalid remote state", {
      reason,
      id: Number(playerData?.id || 0) || "unknown",
      x: playerData?.x,
      y: playerData?.y,
      z: playerData?.z,
      ry: playerData?.ry
    });
  }

  function noteRemoteState(remote, status, reason, playerData, source) {
    runtimeMultiplayer().noteRemoteState(remote, status, reason || "", playerData || null, source || "");
  }

  function decodeNetworkData(playerData, remote, source = "states") {
    return runtimeRemoteSession().applyRemoteState(playerData, remote, {
      source,
      normalizeAvatar: normalizeAvatarFields,
      avatarSignature,
      avatarPatch: (data) => runtimeMultiplayer().remoteAvatarPatch(data),
      readScenePosition: readRemoteScenePositionResult,
      noteState: noteRemoteState,
      applyAvatar: (target, avatar) => vortex.applyAvatarToMeshes?.(target.meshes, {
        ...avatar,
        id: target.id,
        playerId: target.id,
        username: target.username
      }),
      logRejected: logBadRemoteState
    });
  }

  function addRemote(id, username, isStaff, isBooster, avatarData) {
    const remote = runtimeRemoteSession().addRemote({
      id,
      username,
      isStaff,
      isBooster,
      avatarData: avatarData || {},
      displayName: playerDisplayName,
      normalizeAvatar: normalizeAvatarFields,
      readInitialState: (data) => readRemoteScenePosition(data || {}),
      createPosition: () => new THREE.Vector3(),
      canCreateMeshes: () => !!vortex.getCharacter(),
      makeRemote,
      setNameLabel: setRemoteNameLabel,
      decodeRemoteState: decodeNetworkData,
      noteState: noteRemoteState,
      addLeaderboard: (player) => leaderboard().addPlayer(player),
      setFriendStatus: (playerId, status) => leaderboard().setFriendStatus(playerId, status),
      statusFor,
      onCreateError: (error) => console.error("[mp] makeRemote failed:", error)
    });
    if (runtimeMultiplayer().isPlaceholderPlayerName(id, remote?.username || username)) {
      community()?.requestVortexUser?.(id).catch(() => {});
    }
    return remote;
  }

  function removeRemote(id) {
    return runtimeRemoteSession().removeRemote(id, {
      clearBubble,
      disposeMeshes: disposeRemote,
      removeLeaderboard: (playerId) => leaderboard().removePlayer(playerId)
    });
  }

  return {
    readRemoteScenePositionResult,
    recordMultiplayerMessage,
    remoteDebugRows,
    readRemoteScenePosition,
    noteRemoteState,
    decodeNetworkData,
    addRemote,
    removeRemote,
    getRemoteYOffset,
    setRemoteYOffset
  };
}
