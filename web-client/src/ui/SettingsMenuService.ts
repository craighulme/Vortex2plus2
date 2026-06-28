export type SettingsMenuSnapshot = {
  attached: boolean;
  open: boolean;
  activeTab: string;
  reloadNoticeVisible: boolean;
};

export type SettingsMenuOverlayState = {
  visible: boolean;
  blocksPointer: boolean;
};

type SettingsMenuElements = {
  panel: HTMLElement | null | undefined;
  overlay?: HTMLElement | null | undefined;
  title?: HTMLElement | null | undefined;
  reloadNotice?: HTMLElement | null | undefined;
  status?: HTMLElement | null | undefined;
  targets?: Partial<Record<SettingsMenuTarget, HTMLElement | null | undefined>>;
};

export type SettingsMenuTarget = "audio" | "graphics" | "advanced" | "dev" | "game";

export type SettingsMenuOption = {
  value: string;
  label: string;
};

export type SettingsMenuButton = {
  label: string;
  primary?: boolean;
  requiresUserGesture?: boolean;
  onclick: () => void | Promise<void>;
};

export type SettingsSliderControl = {
  container: HTMLElement;
  input: HTMLInputElement;
  value: HTMLElement;
};

export class SettingsMenuService {
  private panel: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private title: HTMLElement | null = null;
  private reloadNotice: HTMLElement | null = null;
  private status: HTMLElement | null = null;
  private targets: Partial<Record<SettingsMenuTarget, HTMLElement>> = {};
  private readonly storage: Pick<Storage, "getItem" | "setItem">;
  private open = false;
  private activeTab = "game";
  private reloadNoticeVisible = false;

  constructor(
    private readonly document: Document,
    storage?: Pick<Storage, "getItem" | "setItem">
  ) {
    this.storage = storage ?? readStorage();
  }

  attach(elements: SettingsMenuElements): void {
    this.panel = elements.panel ?? null;
    this.overlay = elements.overlay ?? null;
    this.title = elements.title ?? null;
    this.reloadNotice = elements.reloadNotice ?? null;
    this.status = elements.status ?? null;
    this.targets = {};
    for (const [key, target] of Object.entries(elements.targets ?? {}) as Array<[SettingsMenuTarget, HTMLElement | null | undefined]>) {
      if (target) this.targets[key] = target;
    }
    if (this.panel) {
      this.panel.setAttribute("aria-hidden", this.open ? "false" : "true");
      this.panel.style.display = this.open ? "" : "none";
    }
    this.syncReloadNotice();
    this.syncBodyClass();
    this.syncTitle();
  }

  setOpen(open: boolean): void {
    this.open = open;
    if (this.panel) {
      const containsActiveElement = typeof this.panel.contains === "function"
        ? this.panel.contains(this.document.activeElement)
        : false;
      if (!open && containsActiveElement) {
        (this.document.activeElement as HTMLElement | null)?.blur?.();
      }
      (this.panel as HTMLElement & { inert?: boolean }).inert = !open;
      this.panel.style.display = open ? "" : "none";
      this.panel.setAttribute("aria-hidden", open ? "false" : "true");
    }
    this.syncBodyClass();
  }

  isOpen(): boolean {
    return this.open;
  }

  toggle(): boolean {
    this.setOpen(!this.open);
    return this.open;
  }

  setTab(tabName: string): void {
    const tab = String(tabName || "game");
    this.activeTab = tab;
    if (!this.panel) return;
    const activeTab = [...this.panel.querySelectorAll<HTMLElement>("[data-settings-tab]")]
      .find((button) => button.dataset.settingsTab === tab);
    for (const button of this.panel.querySelectorAll<HTMLElement>("[data-settings-tab]")) {
      button.classList.toggle("active", button.dataset.settingsTab === tab);
    }
    for (const section of this.panel.querySelectorAll<HTMLElement>("[data-settings-section]")) {
      section.classList.toggle("active", section.dataset.settingsSection === tab);
    }
    const title = activeTab?.textContent?.trim() || "Settings";
    this.setTitle(title === "Game" ? "Settings" : title);
  }

  syncOverlay(state: SettingsMenuOverlayState): void {
    if (!this.overlay) return;
    this.overlay.style.opacity = state.visible ? "1" : "0";
    this.overlay.style.pointerEvents = state.blocksPointer ? "auto" : "none";
  }

  target(name: SettingsMenuTarget): HTMLElement | null {
    return this.targets[name] ?? this.panel;
  }

  inferTarget(label: string): HTMLElement | null {
    const text = String(label || "").toLowerCase();
    if (text.includes("music") || text.includes("sfx") || text.includes("master") || text.includes("chat")) return this.target("audio");
    if (text.includes("shadow") || text.includes("graphics") || text.includes("fog") || text.includes("stud")) return this.target("graphics");
    return this.panel;
  }

  showReloadNotice(): void {
    this.reloadNoticeVisible = true;
    this.syncReloadNotice();
  }

  hideReloadNotice(): void {
    this.reloadNoticeVisible = false;
    this.syncReloadNotice();
  }

  renderStatus(entries: Array<[string, unknown]>): void {
    if (!this.status) return;
    this.status.innerHTML = entries.map(([label, value]) => `
        <div class="vw-status">
            <div class="vw-status-label">${escapeHtml(label)}</div>
            <div class="vw-status-value">${escapeHtml(value)}</div>
        </div>
    `).join("");
  }

  routeCursorClick(cursorOver: (element: Element) => boolean): boolean {
    if (!this.open || !this.panel || !cursorOver(this.panel)) return false;
    const controls = this.panel.querySelectorAll<HTMLElement>("button, input, select");
    for (const control of controls) {
      if (!cursorOver(control)) continue;
      if (control.dataset.requiresUserGesture === "true") return true;
      if ((control as HTMLInputElement).type === "range") return true;
      control.focus?.();
      control.click?.();
      return true;
    }
    return true;
  }

  createSlider(options: {
    label: string;
    min: number;
    max: number;
    defaultValue: number;
    step: number;
    storageKey?: string;
    formatter?: (value: number) => string;
    target?: HTMLElement | null;
    onChange: (input: HTMLInputElement, value: number) => void;
  }): SettingsSliderControl {
    const storageKey = options.storageKey || options.label;
    const saved = this.storage.getItem(storageKey);
    const initial = saved !== null ? Number.parseFloat(saved) : options.defaultValue;
    const value = Number.isFinite(initial) ? initial : options.defaultValue;
    const formatter = options.formatter ?? ((next) => String(next));
    const target = options.target ?? this.inferTarget(options.label);
    const row = this.document.createElement("div");
    row.className = "sp-row";
    const label = this.document.createElement("span");
    label.className = "sp-label";
    label.textContent = options.label;
    const input = this.document.createElement("input");
    input.type = "range";
    input.min = String(options.min);
    input.max = String(options.max);
    input.step = String(options.step);
    input.value = String(value);
    const readout = this.document.createElement("span");
    readout.className = "sp-val";
    readout.textContent = formatter(value);
    input.oninput = () => {
      const next = Number(input.value);
      readout.textContent = formatter(next);
      this.storage.setItem(storageKey, input.value);
      options.onChange(input, next);
      this.document.dispatchEvent(new CustomEvent("vortex-settings-control-change", { detail: { label: options.label } }));
    };
    row.append(label, input, readout);
    target?.appendChild(row);
    options.onChange(input, value);
    return { container: row, input, value: readout };
  }

  createToggle(options: {
    label: string;
    checked: boolean;
    target?: HTMLElement | null;
    title?: string;
    disabled?: boolean;
    onChange: (checked: boolean, input: HTMLInputElement) => void;
  }): HTMLInputElement {
    const row = this.document.createElement("div");
    row.className = "vw-toggle-row";
    const label = this.document.createElement("span");
    label.className = "vw-toggle-label";
    label.textContent = options.label;
    const input = this.document.createElement("input");
    input.type = "checkbox";
    input.className = "vw-toggle";
    input.checked = Boolean(options.checked);
    input.disabled = Boolean(options.disabled);
    if (options.title) input.title = options.title;
    input.onchange = () => {
      options.onChange(input.checked, input);
      this.document.dispatchEvent(new CustomEvent("vortex-settings-control-change", { detail: { label: options.label } }));
    };
    row.append(label, input);
    (options.target ?? this.target("advanced"))?.appendChild(row);
    return input;
  }

  createSelect(options: {
    label: string;
    value: string;
    options: SettingsMenuOption[];
    target?: HTMLElement | null;
    title?: string;
    disabled?: boolean;
    onChange: (value: string, input: HTMLSelectElement) => void;
  }): HTMLSelectElement {
    const field = this.document.createElement("div");
    field.className = "vw-field";
    const label = this.document.createElement("label");
    const id = `vw-select-${options.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    label.htmlFor = id;
    label.textContent = options.label;
    const select = this.document.createElement("select");
    select.id = id;
    select.className = "vw-select";
    select.disabled = Boolean(options.disabled);
    if (options.title) select.title = options.title;
    for (const option of options.options) {
      const item = this.document.createElement("option");
      item.value = option.value;
      item.textContent = option.label;
      select.appendChild(item);
    }
    select.value = options.value;
    select.onchange = () => {
      options.onChange(select.value, select);
      this.document.dispatchEvent(new CustomEvent("vortex-settings-control-change", { detail: { label: options.label } }));
    };
    field.append(label, select);
    (options.target ?? this.target("advanced"))?.appendChild(field);
    return select;
  }

  createButtonRow(buttons: SettingsMenuButton[], target: HTMLElement | null = this.target("dev")): HTMLElement {
    const row = this.document.createElement("div");
    row.className = "vw-inline-buttons";
    for (const button of buttons) {
      const element = this.document.createElement("button");
      element.type = "button";
      element.className = `vw-small-button${button.primary ? " primary" : ""}`;
      element.textContent = button.label;
      if (button.requiresUserGesture) element.dataset.requiresUserGesture = "true";
      element.onclick = () => {
        void button.onclick();
      };
      row.appendChild(element);
    }
    target?.appendChild(row);
    return row;
  }

  snapshot(): SettingsMenuSnapshot {
    return {
      attached: Boolean(this.panel),
      open: this.open,
      activeTab: this.activeTab,
      reloadNoticeVisible: this.reloadNoticeVisible
    };
  }

  private setTitle(value: string): void {
    if (this.title) this.title.textContent = value;
  }

  private syncTitle(): void {
    this.setTab(this.activeTab);
  }

  private syncBodyClass(): void {
    this.document.body.classList.toggle("vw-menu-open", this.open);
  }

  private syncReloadNotice(): void {
    if (!this.panel || !this.reloadNotice) return;
    this.reloadNotice.hidden = !this.reloadNoticeVisible;
    this.panel.classList.toggle("has-reload-notice", this.reloadNoticeVisible);
  }
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function readStorage(): Pick<Storage, "getItem" | "setItem"> {
  const storage = (globalThis as typeof globalThis & { localStorage?: Storage }).localStorage;
  if (storage) return storage;
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    }
  };
}
