import { describe, expect, it } from "vitest";
import { SettingsMenuService } from "../ui/SettingsMenuService";

class FakeClassList {
  values = new Set<string>();

  toggle(name: string, force?: boolean): boolean {
    const enabled = force ?? !this.values.has(name);
    if (enabled) this.values.add(name);
    else this.values.delete(name);
    return enabled;
  }

  contains(name: string): boolean {
    return this.values.has(name);
  }
}

class FakeElement {
  className = "";
  dataset: Record<string, string> = {};
  disabled = false;
  hidden = false;
  htmlFor = "";
  id = "";
  innerHTML = "";
  max = "";
  min = "";
  onchange: (() => void) | null = null;
  oninput: (() => void) | null = null;
  step = "";
  style: Record<string, string> = {};
  textContent = "";
  title = "";
  type = "";
  value = "";
  readonly children: FakeElement[] = [];
  readonly classList = new FakeClassList();
  clickCount = 0;
  focusCount = 0;

  append(...children: FakeElement[]): void {
    this.children.push(...children);
  }

  appendChild(child: FakeElement): FakeElement {
    this.children.push(child);
    return child;
  }

  setAttribute(name: string, value: string): void {
    (this as unknown as Record<string, string>)[name] = value;
  }

  click(): void {
    this.clickCount++;
  }

  focus(): void {
    this.focusCount++;
  }

  querySelectorAll(selector?: string): FakeElement[] {
    const children = [...this.children];
    for (const child of this.children) children.push(...child.querySelectorAll(selector));
    if (!selector) return children;
    if (selector === "button, input, select") {
      return children.filter((child) => ["button", "input", "select"].includes(child.type));
    }
    return [];
  }
}

function makeDocument() {
  return {
    body: new FakeElement(),
    createElement: () => new FakeElement(),
    dispatchEvent: () => true
  } as unknown as Document;
}

function makeStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    values
  };
}

describe("SettingsMenuService", () => {
  it("owns reload notices, status rendering, and reusable controls", () => {
    const documentRef = makeDocument();
    const storage = makeStorage({ "Pixel ratio": "0.75" });
    const panel = new FakeElement();
    const reloadNotice = new FakeElement();
    const status = new FakeElement();
    const graphics = new FakeElement();
    const service = new SettingsMenuService(documentRef, storage);

    service.attach({
      panel: panel as unknown as HTMLElement,
      reloadNotice: reloadNotice as unknown as HTMLElement,
      status: status as unknown as HTMLElement,
      targets: { graphics: graphics as unknown as HTMLElement }
    });

    service.showReloadNotice();
    expect(service.snapshot().reloadNoticeVisible).toBe(true);
    expect(reloadNotice.hidden).toBe(false);
    expect(panel.classList.contains("has-reload-notice")).toBe(true);

    service.renderStatus([["Unsafe", "<script>"], ["FPS", 240]]);
    expect(status.innerHTML).toContain("&lt;script&gt;");
    expect(status.innerHTML).toContain("240");

    const slider = service.createSlider({
      label: "Pixel ratio",
      min: 0.5,
      max: 1,
      defaultValue: 1,
      step: 0.05,
      target: graphics as unknown as HTMLElement,
      onChange: (_input, value) => {
        expect(value).toBeGreaterThanOrEqual(0.5);
      }
    });
    expect(slider.input.value).toBe("0.75");
    expect(graphics.children).toContain(slider.container as unknown as FakeElement);

    const toggle = service.createToggle({
      label: "Render fog",
      checked: true,
      target: graphics as unknown as HTMLElement,
      onChange: () => {}
    });
    expect(toggle.checked).toBe(true);

    const select = service.createSelect({
      label: "Graphics API",
      value: "webgpu",
      options: [{ value: "webgpu", label: "WebGPU" }],
      target: graphics as unknown as HTMLElement,
      disabled: true,
      onChange: () => {}
    });
    expect(select.disabled).toBe(true);
  });

  it("routes locked-cursor menu clicks through controls without duplicating engine logic", () => {
    const documentRef = makeDocument();
    const panel = new FakeElement();
    const service = new SettingsMenuService(documentRef, makeStorage());
    service.attach({ panel: panel as unknown as HTMLElement });
    const clicked = service.createToggle({
      label: "Frame profiler",
      checked: false,
      target: panel as unknown as HTMLElement,
      onChange: () => {}
    }) as unknown as FakeElement;
    clicked.type = "input";
    service.setOpen(true);

    expect(service.routeCursorClick((element) => element === (panel as unknown as Element) || element === (clicked as unknown as Element))).toBe(true);
    expect(clicked.focusCount).toBe(1);
    expect(clicked.clickCount).toBe(1);

    service.setOpen(false);
    expect(service.routeCursorClick(() => true)).toBe(false);
  });
});
