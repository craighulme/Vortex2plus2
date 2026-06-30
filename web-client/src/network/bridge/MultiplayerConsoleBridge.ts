// @ts-nocheck
import { createMultiplayerChatCommandBridge } from "./MultiplayerChatCommandBridge";

export function installMultiplayerConsoleBridge(context) {
  const {
    window,
    fetch,
    Chat,
    chatCommands,
    avatar,
    avatarAssets,
    avatarMaterials,
    remotePlayers,
    remoteSession,
    packetDebug,
    vortex,
    runtimeRemoteSession,
    normalizeAvatarFields,
    requireLicenseFeature,
    assertLicenseFeature,
    getLaunchInfo,
    setLaunchInfoAvatar,
    getLocalPlayerId
  } = context;

  const commandBridge = createMultiplayerChatCommandBridge({
    window,
    Chat,
    chatCommands,
    vortex,
    runtimeRemoteSession,
    requireLicenseFeature,
    getLaunchInfo,
    getLocalPlayerId
  });

  window.VortexMovement = chatCommands.createMovementApi({
    movementMods: commandBridge.movementMods,
    setMovementMods: commandBridge.setMovementMods,
    assertFeature: assertLicenseFeature,
  });

  window.VortexAvatar = avatar.createConsoleApi({
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
        assets: avatarAssets?.snapshot?.() || null,
        materials: avatarMaterials?.snapshot?.() || null,
        remoteRender: remotePlayers?.renderCostSnapshot?.(remoteSession?.remotes) || null,
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
      avatarAssets?.clearDiagnostics?.();
      avatarMaterials?.clearDiagnostics?.();
      return true;
    }
  };

  function remoteAvatarRows() {
    const materialDiagnostics = avatarMaterials?.snapshot?.().diagnostics || [];
    const packetPlayers = new Map((packetDebug?.players?.() || []).map((player) => [Number(player.id), player]));
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

  return { handleChatCommand: commandBridge.handleChatCommand };
}
