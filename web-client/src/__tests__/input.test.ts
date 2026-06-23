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
});
