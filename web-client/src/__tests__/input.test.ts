import { describe, expect, it } from "vitest";
import { InputService } from "../input/InputService";

class FakeDocument extends EventTarget {
  pointerLockElement: EventTarget | null = null;
}

class FakeTarget extends EventTarget {
  requestCount = 0;

  requestPointerLock(): Promise<void> {
    this.requestCount += 1;
    return Promise.resolve();
  }
}

describe("InputService", () => {
  it("tracks pause and resume-pending states without opening the menu immediately", () => {
    const documentRef = new FakeDocument();
    const windowRef = new EventTarget();
    const target = new FakeTarget();
    const input = new InputService(documentRef as unknown as Document, windowRef as unknown as Window);
    input.attachTarget(target as unknown as HTMLElement);

    expect(input.snapshot().focusState).toBe("idle");
    expect(input.overlayState()).toEqual({ visible: false, blocksPointer: true });

    input.markGameStarted();
    input.setPauseOpen(true);
    expect(input.snapshot()).toMatchObject({ focusState: "paused", pauseOpen: true });
    expect(input.overlayState()).toEqual({ visible: true, blocksPointer: true });

    expect(input.requestResume()).toBe("pending");
    expect(input.snapshot()).toMatchObject({ focusState: "resume-pending", resumePending: true });
    expect(input.overlayState()).toEqual({ visible: false, blocksPointer: true });
  });

  it("keeps Chrome pointer-lock cooldown errors pending but opens pause for other failures", () => {
    const documentRef = new FakeDocument();
    const windowRef = new EventTarget();
    const input = new InputService(documentRef as unknown as Document, windowRef as unknown as Window);

    input.markGameStarted();
    expect(input.handlePointerLockFailure({
      name: "SecurityError",
      message: "Pointer lock cannot be acquired immediately after the user has exited the lock."
    })).toBe("resume-pending");
    expect(input.snapshot()).toMatchObject({ focusState: "resume-pending", resumePending: true });

    expect(input.handlePointerLockFailure({
      name: "WrongDocumentError",
      message: "The root document of this element is not valid for pointer lock."
    })).toBe("pause");
    expect(input.snapshot()).toMatchObject({ focusState: "paused", pauseOpen: true });
  });

  it("clears pressed keys when the browser window loses focus", () => {
    const documentRef = new FakeDocument();
    const windowRef = new EventTarget();
    const target = new FakeTarget();
    const input = new InputService(documentRef as unknown as Document, windowRef as unknown as Window);
    input.attachTarget(target as unknown as HTMLElement);
    documentRef.pointerLockElement = target;
    documentRef.dispatchEvent(new Event("pointerlockchange"));
    const keydown = new Event("keydown") as KeyboardEvent;
    Object.defineProperties(keydown, {
      code: { value: "KeyW" },
      repeat: { value: false },
      altKey: { value: false },
      ctrlKey: { value: false },
      metaKey: { value: false },
      shiftKey: { value: false }
    });
    documentRef.dispatchEvent(keydown);

    expect(input.snapshot().pressed).toContain("KeyW");

    windowRef.dispatchEvent(new Event("blur"));

    expect(input.snapshot().pressed).not.toContain("KeyW");
  });

  it("does not let a stale chat focus flag block gameplay keys", () => {
    const documentRef = new FakeDocument();
    const windowRef = new EventTarget();
    const target = new FakeTarget();
    const input = new InputService(documentRef as unknown as Document, windowRef as unknown as Window);
    input.attachTarget(target as unknown as HTMLElement);
    documentRef.pointerLockElement = target;
    documentRef.dispatchEvent(new Event("pointerlockchange"));

    (globalThis as typeof globalThis & { _chatFocused?: boolean; Chat?: { isActive(): boolean } })._chatFocused = true;
    (globalThis as typeof globalThis & { Chat?: { isActive(): boolean } }).Chat = { isActive: () => false };

    const keydown = new Event("keydown") as KeyboardEvent;
    Object.defineProperties(keydown, {
      code: { value: "Space" },
      repeat: { value: false },
      altKey: { value: false },
      ctrlKey: { value: false },
      metaKey: { value: false },
      shiftKey: { value: false }
    });
    documentRef.dispatchEvent(keydown);

    expect(input.snapshot().pressed).toContain("Space");

    delete (globalThis as typeof globalThis & { _chatFocused?: boolean })._chatFocused;
    delete (globalThis as typeof globalThis & { Chat?: unknown }).Chat;
  });

  it("tracks gameplay keys from the window capture path", () => {
    const documentRef = new FakeDocument();
    const windowRef = new EventTarget();
    const target = new FakeTarget();
    const input = new InputService(documentRef as unknown as Document, windowRef as unknown as Window);
    input.attachTarget(target as unknown as HTMLElement);
    documentRef.pointerLockElement = target;
    documentRef.dispatchEvent(new Event("pointerlockchange"));

    const keydown = new Event("keydown", { cancelable: true }) as KeyboardEvent;
    Object.defineProperties(keydown, {
      code: { value: "Space" },
      key: { value: " " },
      repeat: { value: false },
      altKey: { value: false },
      ctrlKey: { value: false },
      metaKey: { value: false },
      shiftKey: { value: false }
    });
    windowRef.dispatchEvent(keydown);

    expect(input.snapshot()).toMatchObject({
      pressed: ["Space"],
      lastKeyDown: "Space",
      lastKeyRejected: ""
    });
    expect(keydown.defaultPrevented).toBe(true);
  });
});
