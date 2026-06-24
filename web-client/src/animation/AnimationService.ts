export type FootIkConfig = {
  enabled: boolean;
  maxPelvisOffset: number;
  maxLegExtension: number;
  footProbeDistance: number;
  smoothing: number;
};

export class AnimationService {
  private footIk: FootIkConfig = {
    enabled: false,
    maxPelvisOffset: 0.45,
    maxLegExtension: 1.35,
    footProbeDistance: 2.5,
    smoothing: 12
  };

  setFootIk(config: Partial<FootIkConfig>): void {
    const next = { ...this.footIk, ...config };
    next.enabled = Boolean(next.enabled && this.experimentalFootIkEnabled());
    this.footIk = next;
  }

  getFootIk(): FootIkConfig {
    return { ...this.footIk };
  }

  private experimentalFootIkEnabled(): boolean {
    try {
      return globalThis.localStorage?.getItem("v22ExperimentalFootIk") === "1";
    } catch {
      return false;
    }
  }
}
