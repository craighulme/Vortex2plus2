// @ts-nocheck

export function createMultiplayerAccessBridge(context) {
  const {
    localStorage,
    Chat,
    runtimeAccess,
    runtimePacketDebug,
    runtimeMultiplayer,
    getBridgeConfig,
    getLaunchInfo
  } = context;

  function isLocalDevRelay() {
    const cfg = getBridgeConfig();
    return !!(cfg.devLocalRelay && cfg.hubUrl && runtimeMultiplayer().isLocalRelayUrl(cfg.hubUrl));
  }

  function hasLicenseFeature(feature) {
    return runtimeAccess().hasLicenseFeature(feature, {
      launchInfo: getLaunchInfo(),
      isLocalDevRelay: isLocalDevRelay()
    });
  }

  function hasPacketDebugAccess() {
    return runtimeAccess().packetDebug({
      config: getBridgeConfig(),
      launchInfo: getLaunchInfo(),
      isLocalDevRelay: isLocalDevRelay()
    });
  }

  function hasAvatarSpoofAccess() {
    return runtimeAccess().avatarSpoof({
      config: getBridgeConfig(),
      launchInfo: getLaunchInfo(),
      isLocalDevRelay: isLocalDevRelay()
    });
  }

  function syncPacketDebugAccess() {
    return runtimePacketDebug().syncAccess(hasPacketDebugAccess());
  }

  function assertPacketDebugAccess() {
    if (hasPacketDebugAccess()) return true;
    runtimePacketDebug().syncAccess(false);
    localStorage.removeItem("vwebPacketDebug");
    throw new Error("packet debug is not enabled on this license");
  }

  function hasDevToolsEnabled() {
    return runtimeAccess().hasDevTools({
      config: getBridgeConfig(),
      isLocalDevRelay: isLocalDevRelay()
    });
  }

  function requireLicenseFeature(feature, label) {
    if (hasLicenseFeature(feature)) return true;
    const name = label || feature;
    try { Chat.warn(`${name} is not enabled on this license.`); } catch { }
    return false;
  }

  function assertLicenseFeature(feature, label) {
    if (hasLicenseFeature(feature)) return true;
    throw new Error(`${label || feature} is not enabled on this license`);
  }

  return {
    isLocalDevRelay,
    hasLicenseFeature,
    hasPacketDebugAccess,
    hasAvatarSpoofAccess,
    syncPacketDebugAccess,
    assertPacketDebugAccess,
    hasDevToolsEnabled,
    requireLicenseFeature,
    assertLicenseFeature
  };
}
