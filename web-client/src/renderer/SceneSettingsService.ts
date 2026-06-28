export type SceneSettingsConfig = {
  rendererService: {
    applyFog(options: Record<string, unknown>): Record<string, unknown>;
    applyToneMapping(options: Record<string, unknown>): string;
    markMaterialsForUpdate(root: unknown): void;
    setToneMappingMode(mode: string, options: Record<string, unknown>): string;
    setFogEnabled(enabled: boolean, options: Record<string, unknown>): Record<string, unknown>;
    setFogDistance(distance: number, options: Record<string, unknown>): Record<string, unknown>;
    getToneMappingMode(): string;
  };
  scene: unknown;
  THREE: unknown;
  renderer: unknown;
};

export class SceneSettingsService {
  private config: SceneSettingsConfig | null = null;
  private fogSettingsValue: Record<string, unknown> = {};
  private toneMappingModeValue = "none";

  configure(config: SceneSettingsConfig): this {
    this.config = config;
    this.fogSettingsValue = config.rendererService.applyFog({ scene: config.scene, THREE: config.THREE });
    this.toneMappingModeValue = config.rendererService.applyToneMapping({
      renderer: config.renderer,
      THREE: config.THREE,
      mode: config.rendererService.getToneMappingMode()
    });
    return this;
  }

  markMaterialsForShaderUpdate(root: unknown = this.requireConfig().scene): void {
    const config = this.requireConfig();
    config.rendererService.markMaterialsForUpdate(root);
  }

  setToneMappingMode(mode: string): string {
    const config = this.requireConfig();
    this.toneMappingModeValue = config.rendererService.setToneMappingMode(mode, {
      renderer: config.renderer,
      THREE: config.THREE,
      scene: config.scene
    });
    return this.toneMappingModeValue;
  }

  setRenderFog(enabled: boolean): Record<string, unknown> {
    const config = this.requireConfig();
    this.fogSettingsValue = config.rendererService.setFogEnabled(Boolean(enabled), {
      scene: config.scene,
      THREE: config.THREE
    });
    this.markMaterialsForShaderUpdate();
    return this.fogSettingsValue;
  }

  setFogDistance(distance: number): Record<string, unknown> {
    const config = this.requireConfig();
    this.fogSettingsValue = config.rendererService.setFogDistance(Number(distance), {
      scene: config.scene,
      THREE: config.THREE
    });
    this.markMaterialsForShaderUpdate();
    return this.fogSettingsValue;
  }

  readFogSettings(): Record<string, unknown> {
    return this.fogSettingsValue;
  }

  readToneMappingMode(): string {
    return this.toneMappingModeValue;
  }

  snapshot(): { fog: Record<string, unknown>; toneMapping: string } {
    return {
      fog: this.readFogSettings(),
      toneMapping: this.readToneMappingMode()
    };
  }

  private requireConfig(): SceneSettingsConfig {
    if (!this.config) throw new Error("[renderer] SceneSettingsService is not configured.");
    return this.config;
  }
}
