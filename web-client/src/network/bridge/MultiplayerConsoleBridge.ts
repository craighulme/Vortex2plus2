// @ts-nocheck

export function installMultiplayerConsoleBridge(context) {
  const {
    window,
    fetch,
    Chat,
    vortex,
    runtimeRemoteSession,
    remotePlayerService,
    normalizeAvatarFields,
    requireLicenseFeature,
    assertLicenseFeature,
    getLaunchInfo,
    setLaunchInfoAvatar,
    getLocalPlayerId
  } = context;

  function commandPlayerList() {
    return runtimeRemoteSession().commandPlayerList({
      localId: getLocalPlayerId(),
      localUsername: getLaunchInfo()?.username || "You",
      localPosition: vortex.getCharacter?.()?.position?.clone?.() || null
    });
  }

  function movementMods() {
    return vortex.getMovementMods?.() || {
      fly: false,
      noclip: false,
      airwalk: false,
      gravityScale: 1,
      flySpeed: 28
    };
  }

  function setMovementMods(patch = {}) {
    if (!vortex.setMovementMods) throw new Error("movement modifiers are not available in this build");
    return vortex.setMovementMods(patch);
  }

  function teleportLocalToScene(x, y, z) {
    const char = vortex.getCharacter?.();
    if (!char) return false;
    char.position.set(Number(x), Number(y), Number(z));
    vortex.setVelY?.(0);
    vortex.setGrounded?.(false);
    return true;
  }

  window._mpHandleChatCommand = function (text) {
    return window.VortexRuntime.chatCommands.handle(text, {
      chat: Chat,
      players: commandPlayerList,
      localPosition: () => vortex.getCharacter?.()?.position || null,
      movementMods,
      setMovementMods,
      requireFeature: requireLicenseFeature,
      teleportLocal: teleportLocalToScene,
      bringPlayer: (player) => {
        const char = vortex.getCharacter?.();
        const remote = runtimeRemoteSession().get(player.id);
        if (!char || !remote) return false;
        const pos = char.position.clone();
        pos.x += Math.sin(char.rotation.y || 0) * 3;
        pos.z += Math.cos(char.rotation.y || 0) * 3;
        remote.tPos.copy(pos);
        remote.meshes?.grp?.position?.copy(pos);
        remote.meshes && (remote.meshes.grp.visible = true);
        remote.seen = performance.now();
        return true;
      },
    });
  };

  window._mpRebuildAvatars = function () {
    runtimeRemoteSession().rebuildAll({
      service: remotePlayerService(),
      normalizeAvatar: normalizeAvatarFields,
      onError: (error) => console.error("[mp] avatar rebuild failed:", error),
    });
  };

  window.VortexMovement = window.VortexRuntime.chatCommands.createMovementApi({
    movementMods,
    setMovementMods,
    assertFeature: assertLicenseFeature,
  });

  window.VortexAvatar = window.VortexRuntime.avatar.createConsoleApi({
    async persistOutfit(normalized) {
      const res = await fetch("/api/clothing/outfit", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          shirt_id: normalized.shirt_id,
          pant_id: normalized.pant_id,
          body_type: normalized.body_type,
          body_colors: normalized.body_colors,
          face_id: normalized.face_id
        })
      });
      if (!res.ok) throw new Error(`outfit update failed: HTTP ${res.status} ${await res.text().catch(() => "")}`);
    },
    syncLaunchInfo(normalized) {
      setLaunchInfoAvatar(normalized);
    },
  });

  window.VortexAvatarDiagnostics = {
    snapshot() {
      return {
        assets: window.VortexRuntime.avatarAssets?.snapshot?.() || null,
        materials: window.VortexRuntime.avatarMaterials?.snapshot?.() || null,
        remoteRender: window.VortexRuntime.remotePlayers?.renderCostSnapshot?.(window.VortexRuntime.remoteSession?.remotes) || null,
        remotes: remoteAvatarRows()
      };
    },
    remotes() {
      const rows = remoteAvatarRows();
      console.table(rows);
      return rows;
    },
    remote(id) {
      const row = remoteAvatarRows().find((item) => Number(item.id) === Number(id));
      console.log("[Vortex Web] remote avatar", row || null);
      return row || null;
    },
    log() {
      const snapshot = this.snapshot();
      console.log("[Vortex Web] avatar diagnostics", snapshot);
      const assetRows = snapshot.assets?.diagnostics || [];
      const materialRows = snapshot.materials?.diagnostics || [];
      if (assetRows.length) console.table(assetRows);
      if (materialRows.length) console.table(materialRows);
      if (snapshot.remotes?.length) console.table(snapshot.remotes);
      return snapshot;
    },
    clear() {
      window.VortexRuntime.avatarAssets?.clearDiagnostics?.();
      window.VortexRuntime.avatarMaterials?.clearDiagnostics?.();
      return true;
    }
  };

  function remoteAvatarRows() {
    const materialDiagnostics = window.VortexRuntime.avatarMaterials?.snapshot?.().diagnostics || [];
    const packetPlayers = new Map((window.VortexRuntime.packetDebug?.players?.() || []).map((player) => [Number(player.id), player]));
    return [...runtimeRemoteSession().remotes.entries()].map(([id, remote]) => {
      const playerId = Number(id);
      const avatar = normalizeAvatarFields(remote.avatar || {});
      const packet = packetPlayers.get(playerId) || null;
      return {
        id: playerId,
        username: String(remote.username || ""),
        visible: Boolean(remote.meshes?.grp?.visible || remote.meshes?.proxy?.visible),
        shirt_id: avatar.shirt_id,
        pant_id: avatar.pant_id,
        face_id: avatar.face_id,
        body_type: avatar.body_type,
        body_colors: Array.isArray(avatar.body_colors) ? avatar.body_colors.join(",") : "",
        packet_face_id: packet?.face_id ?? null,
        packet_has_avatar: packet?.has_avatar ?? null,
        shirt: overlayState(remote.meshes?.shirtMesh),
        pants: overlayState(remote.meshes?.pantsMesh),
        face: overlayState(remote.meshes?.faceMesh),
        faceIssue: avatar.face_id ? latestIssue(materialDiagnostics, playerId, "face") : "packet-face-id-zero",
        shirtIssue: avatar.shirt_id ? latestIssue(materialDiagnostics, playerId, "shirt") : "packet-shirt-id-zero",
        pantsIssue: avatar.pant_id ? latestIssue(materialDiagnostics, playerId, "pants") : "packet-pants-id-zero"
      };
    });
  }

  function overlayState(mesh) {
    if (!mesh) return "missing-overlay";
    let hasMap = Boolean(mesh.material?.map);
    let visible = Boolean(mesh.visible);
    mesh.traverse?.((child) => {
      if (!/Overlay$/.test(child.name || "")) return;
      if (child.material?.map) hasMap = true;
      if (child.visible) visible = true;
    });
    if (hasMap && visible) return "loaded-visible";
    if (hasMap) return "loaded-hidden";
    if (visible) return "visible-no-map";
    return "hidden-no-map";
  }

  function latestIssue(diagnostics, playerId, slot) {
    for (let index = diagnostics.length - 1; index >= 0; index -= 1) {
      const row = diagnostics[index];
      if (Number(row.playerId) !== Number(playerId) || row.slot !== slot) continue;
      if (row.status === "loaded") return "";
      return `${row.status}:${row.reason || ""}`.replace(/:$/, "");
    }
    return "no-apply-diagnostic";
  }
}
