import type { BridgeConfig, LaunchIdentity } from "./PlatformBridge";

export class AccessService {
  hasDevTools(input: {
    config: Pick<BridgeConfig, "devFeatures" | "devLocalRelay">;
    isLocalDevRelay?: boolean;
  }): boolean {
    return !!(input.config.devFeatures || input.config.devLocalRelay || input.isLocalDevRelay);
  }

  hasLicenseFeature(feature: string, input: {
    launchInfo: Pick<LaunchIdentity, "licenseLease" | "licenseFeatures"> | null | undefined;
    isLocalDevRelay?: boolean;
  }): boolean {
    if (!feature) return true;
    const launchInfo = input.launchInfo;
    if (!launchInfo?.licenseLease && !Array.isArray(launchInfo?.licenseFeatures)) return !!input.isLocalDevRelay;
    return Array.isArray(launchInfo.licenseFeatures) && licenseFeatureAliases(feature).some((item) => launchInfo.licenseFeatures?.includes(item));
  }

  hasFeatureAccess(feature: string, input: {
    config: Pick<BridgeConfig, "devFeatures" | "devLocalRelay">;
    launchInfo: Pick<LaunchIdentity, "licenseLease" | "licenseFeatures"> | null | undefined;
    isLocalDevRelay?: boolean;
  }): boolean {
    return this.hasDevTools(input) && this.hasLicenseFeature(feature, input);
  }

  packetDebug(input: {
    config: Pick<BridgeConfig, "devFeatures" | "devLocalRelay">;
    launchInfo: Pick<LaunchIdentity, "licenseLease" | "licenseFeatures"> | null | undefined;
    isLocalDevRelay?: boolean;
  }): boolean {
    return this.hasLicenseFeature("packet-debug", input);
  }

  avatarSpoof(input: {
    config: Pick<BridgeConfig, "devFeatures" | "devLocalRelay">;
    launchInfo: Pick<LaunchIdentity, "licenseLease" | "licenseFeatures"> | null | undefined;
    isLocalDevRelay?: boolean;
  }): boolean {
    return this.hasFeatureAccess("avatar-spoof", input);
  }
}

function licenseFeatureAliases(feature: string): string[] {
  return feature === "packet-debug" ? ["packet-debug", "debug"] : [feature];
}
