import type { CameraService } from "../camera/CameraService";
import type { CursorService } from "./CursorService";
import type { InputService } from "./InputService";

type RendererElement = HTMLElement & {
  requestPointerLock?: () => Promise<void> | void;
};

type CharacterLike = {
  rotation: {
    y: number;
  };
};

type SettingsPresenterLike = {
  isOpen(): boolean;
  syncOverlay(): void;
  startGameSession(): void;
  setOpen(open: boolean, options?: Record<string, unknown>): void;
  routeClickUnderCursor(cursorOver: (element: Element | null | undefined) => boolean): boolean;
  refreshStatus(): void;
  panel(): HTMLElement | null;
};

export type EngineInputRuntimeConfig = {
  document: Document;
  rendererElement: RendererElement;
  overlay: HTMLElement | null;
  cursorElement: HTMLElement;
  crosshairElement: HTMLElement;
  input: InputService;
  cursor: CursorService;
  camera: CameraService;
  settingsPresenter: SettingsPresenterLike;
  isFirstPerson(): boolean;
  getShiftLock(): boolean;
  setShiftLock(value: boolean): void;
  routeLockedClick(): boolean;
  onJumpRequest(): void;
  onToggleDebug(): void;
  getCharacter(): CharacterLike | null;
};

export type EngineInputRuntimeHandles = {
  keys: InputService["keys"];
  cursor: CursorService;
  requestPointerLock(): void;
  setMouseLock(value: boolean): void;
  cursorOver(element: Element | null | undefined): boolean;
  syncPauseOverlay(): void;
  setSettingsOpen(open: boolean, options?: Record<string, unknown>): void;
  startGameSession(): void;
  routeSettingsClickUnderCursor(): boolean;
  refreshSettingsStatus(): void;
  panel(): HTMLElement | null;
};

export class EngineInputRuntimeService {
  private cleanups: Array<() => void> = [];

  configure(config: EngineInputRuntimeConfig): EngineInputRuntimeHandles {
    this.dispose();
    const {
      document,
      rendererElement,
      overlay,
      input,
      cursor,
      camera,
      settingsPresenter
    } = config;

    input.attachTarget(rendererElement);
    cursor.configure({
      cursorElement: config.cursorElement,
      crosshairElement: config.crosshairElement,
      rotateCharacterToCanonical: () => {
        const character = config.getCharacter();
        if (!character) return;
        character.rotation.y = ((character.rotation.y % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        if (character.rotation.y > Math.PI) character.rotation.y -= 2 * Math.PI;
      }
    });

    const setMouseLock = (value: boolean) => {
      cursor.setMouseLook(!!value);
    };
    const requestPointerLock = () => {
      input.requestPointerLock(rendererElement);
    };
    const openPauseMenu = () => {
      settingsPresenter.setOpen(true);
    };
    const syncPauseOverlay = () => {
      settingsPresenter.syncOverlay();
    };
    const startGameSession = () => {
      settingsPresenter.startGameSession();
    };
    const cursorOver = (element: Element | null | undefined) => cursor.cursorOver(element);

    this.onCustom(document, "vortex-input-keydown", (event) => {
      const code = (event as CustomEvent<{ code?: string }>).detail?.code;
      if (code === "ShiftLeft" || code === "ShiftRight") {
        const next = !config.getShiftLock();
        config.setShiftLock(next);
        if (!config.isFirstPerson()) setMouseLock(next);
      }
      if (code === "Comma") camera.snapYaw(1);
      if (code === "Period") camera.snapYaw(-1);
      if (code === "Space") config.onJumpRequest();
      if (code === "Backquote") config.onToggleDebug();
    });

    this.onCustom(document, "vortex-input-pointerlock-error", (event) => {
      const error = (event as CustomEvent<{ error?: unknown }>).detail?.error;
      console.warn("[pointer-lock] request failed", error);
      const result = input.handlePointerLockFailure(error);
      syncPauseOverlay();
      if (result === "pause") openPauseMenu();
    });

    this.on(rendererElement, "pointerdown", (event) => {
      if (settingsPresenter.isOpen() || document.pointerLockElement) return;
      const shouldStart = input.shouldStartFromPointerDown();
      if (!shouldStart) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      input.beginPointerStart();
      startGameSession();
    }, { capture: true });

    this.on(document, "pointerlockchange", () => {
      cursor.syncPointerLock(input.isLocked());
      if (!input.isLocked()) {
        const shouldOpenPause = input.shouldOpenPauseOnUnlock();
        if (!settingsPresenter.isOpen() && shouldOpenPause) openPauseMenu();
      }
      syncPauseOverlay();
    });

    this.on(rendererElement, "mousedown", (event) => {
      if (event.button === 2) {
        cursor.setRightMouseDown(true);
        return;
      }
      if (event.button !== 0 || !input.isLocked()) return;
      const settingsPanel = settingsPresenter.panel();
      if (!settingsPanel || settingsPanel.style.display === "none") return;
      for (const slider of settingsPanel.querySelectorAll<HTMLInputElement>("input[type=range]")) {
        if (cursorOver(slider)) {
          cursor.beginSliderDrag(slider);
          return;
        }
      }
    });

    this.on(document, "mouseup", (event) => {
      if (event.button === 2) cursor.setRightMouseDown(false);
      if (event.button === 0) cursor.endSliderDrag();
    });

    this.on(document, "mousemove", (event) => {
      if (!input.isLocked()) return;
      cursor.handleMouseMove(event, (movementX, movementY) => camera.pointerLook(movementX, movementY));
    });

    this.on(rendererElement, "wheel", (event) => {
      if (input.isLocked() && cursor.scrollHovered(["chat-messages", "lb-body"], event.deltaY, document)) return;
      const zoomIntent = camera.zoomWheel(event.deltaY);
      setMouseLock(zoomIntent.firstPerson ? true : config.getShiftLock());
    }, { passive: true });

    this.on(rendererElement, "click", () => {
      if (input.isLocked() && config.routeLockedClick()) return;
      requestPointerLock();
    });

    if (overlay) {
      this.on(overlay, "click", () => {
        if (settingsPresenter.isOpen()) return;
        input.beginPointerStart();
        startGameSession();
      });
      input.attachOverlay(overlay, () => settingsPresenter.isOpen() || input.overlayState().blocksPointer);
    }

    return {
      keys: input.keys,
      cursor,
      requestPointerLock,
      setMouseLock,
      cursorOver,
      syncPauseOverlay,
      setSettingsOpen: (open, options = {}) => settingsPresenter.setOpen(open, options),
      startGameSession,
      routeSettingsClickUnderCursor: () => settingsPresenter.routeClickUnderCursor(cursorOver),
      refreshSettingsStatus: () => settingsPresenter.refreshStatus(),
      panel: () => settingsPresenter.panel()
    };
  }

  dispose(): void {
    for (const cleanup of this.cleanups.splice(0)) cleanup();
  }

  private on<K extends keyof DocumentEventMap>(
    target: Document,
    type: K,
    listener: (event: DocumentEventMap[K]) => void,
    options?: AddEventListenerOptions
  ): void;
  private on<K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions
  ): void;
  private on(
    target: Document | HTMLElement,
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions
  ): void {
    target.addEventListener(type, listener, options);
    this.cleanups.push(() => target.removeEventListener(type, listener, options));
  }

  private onCustom(
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions
  ): void {
    target.addEventListener(type, listener, options);
    this.cleanups.push(() => target.removeEventListener(type, listener, options));
  }
}
