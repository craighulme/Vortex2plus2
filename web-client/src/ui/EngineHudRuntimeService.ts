export type EngineHudRuntimeOptions = {
  document: Document;
  windowRef: Window & Record<string, any>;
  runtime: Record<string, any>;
  renderer: any;
  rendererService: any;
  shadows: any;
  shadowConfig: any;
  perf: any;
  readStorageFlag(key: string, fallback?: boolean): boolean;
  runtimeAsset(path: string, fallbackKey?: string | null): string | null;
  resetCharacterToSpawn(): unknown;
  readCharacterPosition(): unknown;
  readFogSettings(): unknown;
  readToneMappingMode(): unknown;
  readShadowsEnabled(): boolean;
  readStudTexturesEnabled(): boolean;
  setShadowsEnabled(value: boolean): boolean;
  setShadowQuality(value: string): unknown;
  setToneMappingMode(value: string): unknown;
  setRenderFog(value: boolean): unknown;
  setFogDistance(value: number): unknown;
  refreshStudMaterialTextures(): void;
  markSceneMaterialsForShaderUpdate(): void;
  input: any;
  cursor: any;
  camera: any;
  localMovement: any;
  getCharacter(): unknown;
  isFirstPerson(): boolean;
  onToggleDebug(): void;
};

export type EngineHudRuntimeHandles = {
  requestPointerLock(): void;
  setMouseLock(value: boolean): void;
  cursorOver(element: Element | null): boolean;
  setSettingsOpen(open: boolean, options?: Record<string, unknown>): void;
  syncPauseOverlay(): void;
  startGameSession(): void;
  routeSettingsClickUnderCursor(): boolean;
  refreshSettingsStatus(): void;
};

export class EngineHudRuntimeService {
  configure(options: EngineHudRuntimeOptions): EngineHudRuntimeHandles {
    const overlay = options.document.getElementById("overlay");
    const crosshair = options.document.getElementById("crosshair");
    const cursorElement = options.document.getElementById("cursor");

    if (overlay instanceof HTMLElement) {
      Object.assign(overlay.style, {
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center"
      });
    }

    let inputRuntimeHandles: any = null;
    const requestPointerLock = () => {
      if (inputRuntimeHandles) inputRuntimeHandles.requestPointerLock();
      else options.input.requestPointerLock(options.renderer.domElement);
    };
    const cursorOver = (element: Element | null): boolean => inputRuntimeHandles?.cursorOver(element) || false;
    const routeSettingsClickUnderCursor = (): boolean => inputRuntimeHandles?.routeSettingsClickUnderCursor() || false;

    const settingsPresenter = options.runtime.runtimeSettings.mount({
      runtime: options.runtime,
      renderer: options.renderer,
      rendererService: options.rendererService,
      shadows: options.shadows,
      shadowConfig: options.shadowConfig,
      perf: options.perf,
      readStorageFlag: options.readStorageFlag,
      runtimeAsset: options.runtimeAsset,
      requestPointerLock,
      resetCharacterToSpawn: options.resetCharacterToSpawn,
      readCharacterPosition: options.readCharacterPosition,
      readFogSettings: options.readFogSettings,
      readToneMappingMode: options.readToneMappingMode,
      readShadowsEnabled: options.readShadowsEnabled,
      readStudTexturesEnabled: options.readStudTexturesEnabled,
      setShadowsEnabled: options.setShadowsEnabled,
      setShadowQuality: options.setShadowQuality,
      setToneMappingMode: options.setToneMappingMode,
      setRenderFog: options.setRenderFog,
      setFogDistance: options.setFogDistance,
      refreshStudMaterialTextures: options.refreshStudMaterialTextures,
      markSceneMaterialsForShaderUpdate: options.markSceneMaterialsForShaderUpdate
    });

    inputRuntimeHandles = options.runtime.engineInput.configure({
      document: options.document,
      rendererElement: options.renderer.domElement,
      overlay,
      cursorElement,
      crosshairElement: crosshair,
      input: options.input,
      cursor: options.cursor,
      camera: options.camera,
      settingsPresenter,
      isFirstPerson: options.isFirstPerson,
      getShiftLock: () => options.localMovement.getShiftLock(),
      setShiftLock: (value: boolean) => options.localMovement.setShiftLock(value),
      routeLockedClick: () => options.runtime.hudInteractions.routeLockedClick(),
      onJumpRequest: () => options.localMovement.requestJump(),
      onToggleDebug: options.onToggleDebug,
      getCharacter: options.getCharacter
    });
    if (!inputRuntimeHandles) {
      throw new Error("[input] VortexRuntime engine input service is required before the engine starts.");
    }

    options.runtime.hudInteractions.configure({
      cursorOver,
      routeSettingsClick: routeSettingsClickUnderCursor,
      chat: {
        isFocused: () => !!options.windowRef._chatFocused,
        deactivate: () => options.windowRef.Chat?.deactivate(),
        activate: () => options.windowRef.Chat?.activate(),
        send: () => options.windowRef.Chat?.send()
      },
      leaderboard: options.runtime.leaderboard
    });

    return {
      requestPointerLock,
      setMouseLock: (value) => inputRuntimeHandles.setMouseLock(!!value),
      cursorOver,
      setSettingsOpen: (open, settingsOptions = {}) => inputRuntimeHandles.setSettingsOpen(open, settingsOptions),
      syncPauseOverlay: () => inputRuntimeHandles.syncPauseOverlay(),
      startGameSession: () => inputRuntimeHandles.startGameSession(),
      routeSettingsClickUnderCursor,
      refreshSettingsStatus: () => inputRuntimeHandles.refreshSettingsStatus()
    };
  }
}
