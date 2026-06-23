export type InputSnapshot = {
  locked: boolean;
  gameFocused: boolean;
  targetAttached: boolean;
  pauseVisible: boolean;
  pressed: string[];
};

type InputEventDetail = {
  code: string;
  repeat: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};

const BROWSER_KEYS = new Set([
  "Backspace",
  "BrowserBack",
  "BrowserForward",
  "BrowserRefresh",
  "BrowserHome",
  "BrowserSearch",
  "ContextMenu",
  "PrintScreen",
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F10",
  "F11",
  "F12"
]);

export class InputService {
  readonly keys: Record<string, boolean> = {};
  private target: HTMLElement | null = null;
  private targetAttached = false;
  private locked = false;
  private pauseVisible = true;
  private disposed = false;
  private lastPointerLockAttemptAt = 0;

  constructor(private readonly document: Document, private readonly windowRef: Window) {
    this.document.addEventListener("keydown", this.onKeyDown, true);
    this.document.addEventListener("keyup", this.onKeyUp, true);
    this.document.addEventListener("pointerlockchange", this.onPointerLockChange);
    this.windowRef.addEventListener("beforeunload", this.onBeforeUnload);
  }

  attachTarget(target: HTMLElement | null | undefined): void {
    if (!target || this.target === target) return;
    this.target = target;
    target.addEventListener("contextmenu", this.onContextMenu);
    target.addEventListener("pointerdown", this.onPointerDown);
    this.targetAttached = true;
    this.locked = this.document.pointerLockElement === target;
    this.syncGlobalLock();
  }

  attachOverlay(overlay: HTMLElement | null | undefined, ignore?: () => boolean): void {
    if (!overlay) return;
    overlay.addEventListener("pointerdown", () => {
      if (ignore?.()) return;
      this.requestPointerLock();
    });
  }

  requestPointerLock(target: HTMLElement | null | undefined = this.target): void {
    if (!target || this.document.pointerLockElement === target) return;
    const now = performance.now();
    if (now - this.lastPointerLockAttemptAt < 80) return;
    this.lastPointerLockAttemptAt = now;
    try {
      const result = target.requestPointerLock();
      if (result && typeof result.catch === "function") {
        result.catch((error: unknown) => {
          this.document.dispatchEvent(new CustomEvent("vortex-input-pointerlock-error", { detail: { error } }));
        });
      }
    } catch (error) {
      this.document.dispatchEvent(new CustomEvent("vortex-input-pointerlock-error", { detail: { error } }));
    }
  }

  isLocked(): boolean {
    return this.locked;
  }

  gameHasFocus(): boolean {
    return this.locked || this.document.pointerLockElement === this.target;
  }

  setPauseVisible(visible: boolean): void {
    this.pauseVisible = visible;
  }

  snapshot(): InputSnapshot {
    return {
      locked: this.locked,
      gameFocused: this.gameHasFocus(),
      targetAttached: this.targetAttached,
      pauseVisible: this.pauseVisible,
      pressed: Object.keys(this.keys).filter((key) => this.keys[key])
    };
  }

  clearKeys(): void {
    for (const key of Object.keys(this.keys)) this.keys[key] = false;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.document.removeEventListener("keydown", this.onKeyDown, true);
    this.document.removeEventListener("keyup", this.onKeyUp, true);
    this.document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    this.windowRef.removeEventListener("beforeunload", this.onBeforeUnload);
    if (this.target) {
      this.target.removeEventListener("contextmenu", this.onContextMenu);
      this.target.removeEventListener("pointerdown", this.onPointerDown);
    }
    this.clearKeys();
  }

  private readonly onContextMenu = (event: MouseEvent): void => {
    if (this.gameHasFocus()) event.preventDefault();
  };

  private readonly onPointerDown = (): void => {
    if (!this.locked) this.requestPointerLock();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.gameHasFocus() && !isChatFocused() && shouldBlockBrowserShortcut(event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    if (isChatFocused() || !this.locked) return;
    this.keys[event.code] = true;
    this.document.dispatchEvent(new CustomEvent<InputEventDetail>("vortex-input-keydown", { detail: toInputDetail(event) }));
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys[event.code] = false;
    this.document.dispatchEvent(new CustomEvent<InputEventDetail>("vortex-input-keyup", { detail: toInputDetail(event) }));
  };

  private readonly onPointerLockChange = (): void => {
    this.locked = Boolean(this.target && this.document.pointerLockElement === this.target);
    this.pauseVisible = !this.locked;
    if (!this.locked) this.clearKeys();
    this.syncGlobalLock();
    this.document.dispatchEvent(new CustomEvent("vortex-input-focus", { detail: this.snapshot() }));
  };

  private readonly onBeforeUnload = (event: BeforeUnloadEvent): void => {
    if (!this.gameHasFocus()) return;
    event.preventDefault();
    event.returnValue = "";
  };

  private syncGlobalLock(): void {
    (this.windowRef as Window & { locked?: boolean }).locked = this.locked;
  }
}

function shouldBlockBrowserShortcut(event: KeyboardEvent): boolean {
  if (event.code === "Escape") return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return true;
  return BROWSER_KEYS.has(event.code);
}

function isChatFocused(): boolean {
  return Boolean((globalThis as typeof globalThis & { _chatFocused?: unknown })._chatFocused);
}

function toInputDetail(event: KeyboardEvent): InputEventDetail {
  return {
    code: event.code,
    repeat: event.repeat,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey
  };
}
