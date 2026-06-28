import { describe, expect, it, vi } from "vitest";
import { CursorService } from "../input/CursorService";

function element(rect = { left: 0, right: 100, top: 0, bottom: 100 }): HTMLElement {
  return {
    style: {},
    scrollTop: 0,
    getBoundingClientRect: () => rect
  } as unknown as HTMLElement;
}

function windowLike(): Window {
  return { innerWidth: 800, innerHeight: 600 } as Window;
}

describe("CursorService", () => {
  it("tracks cursor position and hit testing", () => {
    const cursor = element();
    const crosshair = element();
    const service = new CursorService(windowLike()).configure({ cursorElement: cursor, crosshairElement: crosshair });

    service.handleMouseMove({ movementX: -350, movementY: -250 }, () => {});

    expect(service.position()).toEqual({ x: 50, y: 50 });
    expect(service.cursorOver(element({ left: 40, right: 60, top: 40, bottom: 60 }))).toBe(true);
  });

  it("routes movement to look handling when mouse look is enabled", () => {
    const service = new CursorService(windowLike()).configure({ cursorElement: element(), crosshairElement: element() });
    const onLook = vi.fn();

    service.setMouseLook(true);
    const result = service.handleMouseMove({ movementX: 5, movementY: -2 }, onLook);

    expect(result).toBe("look");
    expect(onLook).toHaveBeenCalledWith(5, -2);
  });

  it("updates slider drags without duplicating engine math", () => {
    const service = new CursorService(windowLike()).configure({ cursorElement: element(), crosshairElement: element() });
    const slider = {
      min: "0",
      max: "10",
      step: "1",
      value: "5",
      offsetWidth: 100,
      dispatchEvent: vi.fn()
    } as unknown as HTMLInputElement;

    service.beginSliderDrag(slider);
    expect(service.handleMouseMove({ movementX: 20, movementY: 0 }, () => {})).toBe("slider");

    expect(slider.value).toBe("7");
    expect(slider.dispatchEvent).toHaveBeenCalled();
  });
});
