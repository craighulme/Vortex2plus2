import { describe, expect, it } from "vitest";
import { AccessService } from "../platform/AccessService";

describe("AccessService", () => {
  it("allows empty features and local dev fallback", () => {
    const access = new AccessService();
    expect(access.hasLicenseFeature("", { launchInfo: null })).toBe(true);
    expect(access.hasLicenseFeature("packet-debug", { launchInfo: null, isLocalDevRelay: true })).toBe(true);
    expect(access.hasLicenseFeature("packet-debug", { launchInfo: null, isLocalDevRelay: false })).toBe(false);
  });

  it("requires the packet debug license feature for debug access", () => {
    const access = new AccessService();
    const launchInfo = {
      licenseLease: { sub: "lease" },
      licenseFeatures: ["packet-debug"]
    };
    expect(access.packetDebug({
      config: { devFeatures: false, devLocalRelay: false },
      launchInfo,
      isLocalDevRelay: false
    })).toBe(true);
    expect(access.avatarSpoof({
      config: { devFeatures: true, devLocalRelay: false },
      launchInfo,
      isLocalDevRelay: false
    })).toBe(false);
    expect(access.packetDebug({
      config: { devFeatures: false, devLocalRelay: false },
      launchInfo: { licenseLease: { sub: "lease" }, licenseFeatures: [] },
      isLocalDevRelay: false
    })).toBe(false);
    expect(access.packetDebug({
      config: { devFeatures: false, devLocalRelay: false },
      launchInfo: { licenseLease: { sub: "lease" }, licenseFeatures: ["debug"] },
      isLocalDevRelay: false
    })).toBe(true);
  });
});
