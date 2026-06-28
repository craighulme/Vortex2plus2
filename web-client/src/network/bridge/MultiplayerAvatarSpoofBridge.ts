// @ts-nocheck

export function createMultiplayerAvatarSpoofBridge(context) {
  const {
    localStorage,
    console,
    setTimeout,
    normalizeAvatarFields,
    hasAvatarSpoofAccess,
    runtimePacketDebug,
    runtimeSession,
    runtimeMultiplayer,
    vortex,
    bridgeOpen,
    bridgeSend,
    sceneFootOffset,
    sceneYToNativeY,
    getLaunchInfo,
    updateLaunchAvatar,
    setSkipNextRemoteAvatarRebuild
  } = context;

  function currentLaunchAvatar() {
    const launchInfo = getLaunchInfo();
    return normalizeAvatarFields({
      shirt_id: launchInfo?.shirtId || 0,
      pant_id: launchInfo?.pantId || 0,
      body_type: launchInfo?.bodyType || "male",
      body_colors: launchInfo?.bodyColors || [],
      face_id: launchInfo?.faceId || 0
    });
  }

  function joinAvatarOverride() {
    try {
      const raw = localStorage.getItem("vwebJoinAvatar");
      if (!raw) return null;
      return normalizeAvatarFields(JSON.parse(raw));
    } catch (err) {
      console.warn("[mp] ignored invalid join avatar override", err);
      return null;
    }
  }

  function setJoinAvatarOverride(patch = {}) {
    if (!hasAvatarSpoofAccess()) throw new Error("avatar spoofing is not enabled on this license");
    const next = normalizeAvatarFields({ ...currentLaunchAvatar(), ...patch });
    localStorage.setItem("vwebJoinAvatar", JSON.stringify(next));
    return next;
  }

  function clearJoinAvatarOverride() {
    localStorage.removeItem("vwebJoinAvatar");
    return true;
  }

  function applyJoinAvatarToLaunchInfo(avatar) {
    if (!avatar || !getLaunchInfo()) return null;
    return runtimeSession().updateLaunchAvatar(avatar);
  }

  function setOutboundAvatar(patch = {}, rememberOriginal = true, options = {}) {
    if (!hasAvatarSpoofAccess()) throw new Error("avatar spoofing is not enabled on this license");
    if (!getLaunchInfo()) throw new Error("not connected yet");
    if (rememberOriginal) runtimePacketDebug().rememberOriginalAvatar(currentLaunchAvatar());
    const next = normalizeAvatarFields({ ...currentLaunchAvatar(), ...patch });
    updateLaunchAvatar(next);

    const rebuildLocal = options.rebuild !== false && options.applyLocal !== false;
    if (rebuildLocal) {
      if (options.rebuildRemotes === false) setSkipNextRemoteAvatarRebuild(true);
      vortex.applyAvatar?.(next);
    }
    if (options.measure) runtimePacketDebug().addPendingSpoof(next, normalizeAvatarFields);
    if (runtimeSession().hubMode && bridgeOpen()) {
      if (options.persistFormat) {
        runtimeSession().sendJson({ type: "set_movement_format", format: options.persistFormat });
      } else if (options.persistCompact) {
        runtimeSession().sendJson({ type: "set_movement_format", format: "compact" });
      }
      runtimeSession().sendJson({ type: options.compact ? "spoof_avatar_compact" : "spoof_avatar", flush: options.flush !== false, ...next });
    }
    return next;
  }

  function setMovementFormat(format = "native-auto") {
    const requested = String(format || "").toLowerCase();
    const next = requested === "compact" ? "compact"
      : requested === "lite" || requested === "legacy-lite" || requested === "native-lite" || requested === "no-pants" ? "native-lite"
      : requested === "legacy" || requested === "full" || requested === "native-full" ? "native-full"
      : "native-auto";
    if (runtimeSession().hubMode && bridgeOpen()) {
      runtimeSession().sendJson({ type: "set_movement_format", format: next });
    }
    return next;
  }

  function currentState(anim = "idle") {
    const char = vortex.getCharacter?.();
    if (!char) return null;
    return runtimeMultiplayer().buildStateAtScenePosition({
      position: char.position,
      rotationY: char.rotation.y,
      anim,
      convertSceneYToNative: sceneYToNativeY
    });
  }

  function stateAtScenePosition(pos, ry, anim = "idle") {
    return runtimeMultiplayer().buildStateAtScenePosition({
      position: pos,
      rotationY: ry,
      anim,
      convertSceneYToNative: sceneYToNativeY
    });
  }

  function sendStateBurst(state, count = 3, intervalMs = 50) {
    return runtimeSession().sendStateBurst(state, {
      count,
      intervalMs,
      setTimeoutRef: setTimeout,
      send: bridgeSend
    });
  }

  function holdBroadcastState(state, durationMs) {
    runtimeSession().holdBroadcastState(state, durationMs);
  }

  function spoofAvatarResync(patch = {}, options = {}) {
    const delayMs = Math.max(1000, Math.min(15000, Number(options.delayMs ?? options.delay ?? 8000) || 8000));
    const next = setOutboundAvatar(patch || {}, true, {
      persistFormat: options.firstFormat || "native-lite",
      rebuild: options.rebuild !== false,
      applyLocal: options.applyLocal !== false,
      measure: !!options.measure
    });
    setTimeout(() => {
      setMovementFormat(options.finalFormat || "native-auto");
      if (runtimeSession().hubMode && bridgeOpen()) {
        runtimeSession().sendJson({ type: "spoof_avatar", flush: true, ...next });
      }
    }, delayMs);
    return { ...next, resync_delay_ms: delayMs };
  }

  function spoofAvatarDropResync(patch = {}, options = {}) {
    const delayMs = Math.max(3000, Math.min(20000, Number(options.delayMs ?? options.delay ?? 8000) || 8000));
    const next = setOutboundAvatar(patch || {}, true, {
      compact: true,
      persistCompact: true,
      rebuild: options.rebuild !== false,
      applyLocal: options.applyLocal !== false,
      measure: !!options.measure
    });
    setTimeout(() => {
      setMovementFormat(options.finalFormat || "native-auto");
      if (runtimeSession().hubMode && bridgeOpen()) {
        runtimeSession().sendJson({ type: "spoof_avatar", flush: true, ...next });
      }
    }, delayMs);
    return {
      ...next,
      drop_resync: true,
      drop_format: "compact",
      final_format: options.finalFormat || "native-auto",
      delay_ms: delayMs
    };
  }

  function spoofAvatarReset(patch = {}, options = {}) {
    if (!runtimeSession().hubMode || !bridgeOpen()) throw new Error("avatar reset sync requires the local relay connection");
    const char = vortex.getCharacter?.();
    if (!char) throw new Error("character is not ready");

    const original = currentState("idle");
    const spawn = vortex.getSpawn?.() || { x: 0, y: char.position.y - sceneFootOffset(), z: 0, ry: char.rotation.y };
    const spawnScene = {
      x: Number(options.x ?? spawn.x ?? 0),
      y: Number(options.y ?? ((spawn.y ?? 0) + sceneFootOffset())),
      z: Number(options.z ?? spawn.z ?? 0)
    };
    const spawnState = stateAtScenePosition(spawnScene, Number(spawn.ry ?? original.ry ?? char.rotation.y), "jump");
    const burst = Math.max(1, Math.min(10, Number(options.burst ?? 4) || 4));
    const intervalMs = Math.max(25, Math.min(250, Number(options.intervalMs ?? 60) || 60));
    const returnDelayMs = Math.max(80, Math.min(3000, Number(options.returnDelayMs ?? options.delayMs ?? 260) || 260));
    const keepCompact = !!options.keepCompact;

    const next = setOutboundAvatar(patch || {}, true, {
      compact: true,
      persistCompact: true,
      rebuild: options.rebuild !== false,
      applyLocal: options.applyLocal !== false,
      measure: !!options.measure
    });

    setMovementFormat("compact");
    holdBroadcastState(spawnState, returnDelayMs);
    sendStateBurst(spawnState, burst, intervalMs);
    setTimeout(() => {
      if (original) holdBroadcastState({ ...original, anim: "idle" }, intervalMs * burst + 80);
      if (original) sendStateBurst({ ...original, anim: "idle" }, burst, intervalMs);
      if (!keepCompact) {
        setTimeout(() => setMovementFormat("legacy"), Math.max(80, intervalMs * burst));
      }
    }, returnDelayMs);

    return {
      ...next,
      reset_sync: true,
      spawn: { x: spawnState.x, y: spawnState.y, z: spawnState.z },
      burst,
      return_delay_ms: returnDelayMs,
      keep_compact: keepCompact
    };
  }

  function spoofAvatarRejoin() {
    throw new Error("avatar rejoin is disabled: native server treats the reopened UDP socket as another window");
  }

  return {
    currentLaunchAvatar,
    joinAvatarOverride,
    setJoinAvatarOverride,
    clearJoinAvatarOverride,
    applyJoinAvatarToLaunchInfo,
    setOutboundAvatar,
    setMovementFormat,
    currentState,
    stateAtScenePosition,
    sendStateBurst,
    holdBroadcastState,
    spoofAvatarResync,
    spoofAvatarDropResync,
    spoofAvatarReset,
    spoofAvatarRejoin
  };
}
