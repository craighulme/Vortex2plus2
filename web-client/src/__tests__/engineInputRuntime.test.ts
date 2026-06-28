import { describe, expect, it } from "vitest";
import { EngineInputRuntimeService } from "../input/EngineInputRuntimeService";

class FakeElement extends EventTarget {
  style: Record<string, string> = {};
  children: unknown[] = [];
  firstChild: unknown = null;
  querySelectorAll() {
    return [];
  }
}

describe("EngineInputRuntimeService", () => {
  it("routes gameplay input and canvas clicks through runtime services", () => {
    const documentRef = new EventTarget() as Document;
    Object.defineProperty(documentRef, "pointerLockElement", { value: null, configurable: true });
    const rendererElement = new FakeElement() as unknown as HTMLElement;
    const overlay = new FakeElement() as unknown as HTMLElement;
    let pointerLockRequests = 0;
    let targetAttached = false;
    let gameStarted = false;
    let shiftLock = false;
    let jumps = 0;
    let toggles = 0;
    const input = {
      keys: {},
      attachTarget(target: unknown) {
        targetAttached = target === rendererElement;
      },
      requestPointerLock(target: unknown) {
        if (target === rendererElement) pointerLockRequests += 1;
      },
      attachOverlay: () => {},
      shouldStartFromPointerDown: () => true,
      beginPointerStart: () => { gameStarted = true; },
      isLocked: () => false,
      handlePointerLockFailure: () => "pause",
      shouldOpenPauseOnUnlock: () => false,
      overlayState: () => ({ blocksPointer: false })
    };
    const cursor = {
      configured: false,
      mouseLook: false,
      configure() {
        this.configured = true;
        return this;
      },
      setMouseLook(value: boolean) {
        this.mouseLook = value;
      },
      syncPointerLock: () => {},
      setRightMouseDown: () => {},
      beginSliderDrag: () => {},
      endSliderDrag: () => {},
      handleMouseMove: () => "cursor",
      scrollHovered: () => false,
      cursorOver: () => false
    };
    const camera = {
      snaps: [] as number[],
      snapYaw(value: number) {
        this.snaps.push(value);
      },
      pointerLook: () => {},
      zoomWheel: () => ({ firstPerson: false })
    };
    const settingsPresenter = {
      opened: false,
      starts: 0,
      isOpen: () => false,
      syncOverlay: () => {},
      startGameSession() {
        this.starts += 1;
      },
      setOpen(open: boolean) {
        this.opened = open;
      },
      routeClickUnderCursor: () => false,
      refreshStatus: () => {},
      panel: () => null
    };

    new EngineInputRuntimeService().configure({
      document: documentRef,
      rendererElement,
      overlay,
      cursorElement: new FakeElement() as unknown as HTMLElement,
      crosshairElement: new FakeElement() as unknown as HTMLElement,
      input: input as never,
      cursor: cursor as never,
      camera: camera as never,
      settingsPresenter,
      isFirstPerson: () => false,
      getShiftLock: () => shiftLock,
      setShiftLock: (value) => { shiftLock = value; },
      routeLockedClick: () => false,
      onJumpRequest: () => { jumps += 1; },
      onToggleDebug: () => { toggles += 1; },
      getCharacter: () => null
    });

    expect(targetAttached).toBe(true);
    expect(cursor.configured).toBe(true);

    documentRef.dispatchEvent(new CustomEvent("vortex-input-keydown", { detail: { code: "Space" } }));
    documentRef.dispatchEvent(new CustomEvent("vortex-input-keydown", { detail: { code: "ShiftLeft" } }));
    documentRef.dispatchEvent(new CustomEvent("vortex-input-keydown", { detail: { code: "Comma" } }));
    documentRef.dispatchEvent(new CustomEvent("vortex-input-keydown", { detail: { code: "Backquote" } }));

    expect(jumps).toBe(1);
    expect(shiftLock).toBe(true);
    expect(cursor.mouseLook).toBe(true);
    expect(camera.snaps).toEqual([1]);
    expect(toggles).toBe(1);

    rendererElement.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));
    rendererElement.dispatchEvent(new Event("click"));

    expect(gameStarted).toBe(true);
    expect(settingsPresenter.starts).toBe(1);
    expect(pointerLockRequests).toBe(1);
  });
});
