export type CursorServiceOptions = {
  cursorElement: HTMLElement;
  crosshairElement: HTMLElement;
  rotateCharacterToCanonical?: () => void;
};

export type CursorPosition = {
  x: number;
  y: number;
};

export type CursorMoveResult = "cursor" | "look" | "slider" | "ignored";

export class CursorService {
  private options: CursorServiceOptions | null = null;
  private cursorX = 0;
  private cursorY = 0;
  private mouseLook = false;
  private rightMouseDown = false;
  private sliderDrag: HTMLInputElement | null = null;
  private sliderPreciseValue = 0;

  constructor(private readonly windowRef: Window) {
    this.center();
  }

  configure(options: CursorServiceOptions): this {
    this.options = options;
    this.center();
    this.renderCursor();
    return this;
  }

  position(): CursorPosition {
    return { x: this.cursorX, y: this.cursorY };
  }

  mouseLookEnabled(): boolean {
    return this.mouseLook;
  }

  setMouseLook(enabled: boolean): void {
    if (this.mouseLook === enabled) return;
    this.mouseLook = enabled;
    this.center();
    this.renderCursor();
    if (!enabled) this.options?.rotateCharacterToCanonical?.();
  }

  setRightMouseDown(value: boolean): void {
    this.rightMouseDown = value;
  }

  syncPointerLock(locked: boolean): void {
    if (locked) {
      this.renderCursor();
    } else {
      this.rightMouseDown = false;
    }
  }

  cursorOver(element: Element | null | undefined): boolean {
    if (!element || typeof (element as HTMLElement).getBoundingClientRect !== "function") return false;
    const rect = (element as HTMLElement).getBoundingClientRect();
    return this.cursorX >= rect.left && this.cursorX <= rect.right && this.cursorY >= rect.top && this.cursorY <= rect.bottom;
  }

  beginSliderDrag(slider: HTMLInputElement): void {
    this.sliderDrag = slider;
    this.sliderPreciseValue = parseFloat(slider.value);
  }

  endSliderDrag(): void {
    this.sliderDrag = null;
  }

  handleMouseMove(event: Pick<MouseEvent, "movementX" | "movementY">, onLook: (movementX: number, movementY: number) => void): CursorMoveResult {
    if (this.sliderDrag) {
      this.moveCursor(event.movementX, event.movementY);
      this.updateSlider(event.movementX);
      return "slider";
    }

    if (this.mouseLook || this.rightMouseDown) {
      onLook(event.movementX, event.movementY);
      return "look";
    }

    this.moveCursor(event.movementX, event.movementY);
    return "cursor";
  }

  scrollHovered(elementIds: string[], deltaY: number, documentRef: Document): boolean {
    for (const id of elementIds) {
      const element = documentRef.getElementById(id);
      if (!element || !this.cursorOver(element)) continue;
      element.scrollTop += deltaY;
      return true;
    }
    return false;
  }

  private center(): void {
    this.cursorX = this.windowRef.innerWidth / 2;
    this.cursorY = this.windowRef.innerHeight / 2;
  }

  private moveCursor(movementX: number, movementY: number): void {
    this.cursorX = clamp(this.cursorX + movementX, 0, this.windowRef.innerWidth);
    this.cursorY = clamp(this.cursorY + movementY, 0, this.windowRef.innerHeight);
    this.renderCursor();
  }

  private renderCursor(): void {
    if (!this.options) return;
    this.options.crosshairElement.style.display = this.mouseLook ? "block" : "none";
    this.options.cursorElement.style.display = this.mouseLook ? "none" : "block";
    if (!this.mouseLook) this.options.cursorElement.style.transform = `translate(${this.cursorX}px, ${this.cursorY}px)`;
  }

  private updateSlider(movementX: number): void {
    const slider = this.sliderDrag;
    if (!slider) return;
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);
    const step = parseFloat(slider.step);
    const width = slider.offsetWidth || 1;
    const range = max - min;
    this.sliderPreciseValue = clamp(this.sliderPreciseValue + movementX * range / width, min, max);
    const value = clamp(Math.round(this.sliderPreciseValue / step) * step, min, max);
    slider.value = String(value);
    slider.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
