export type SettingsMenuSnapshot = {
  attached: boolean;
  open: boolean;
  activeTab: string;
};

export type SettingsMenuOverlayState = {
  visible: boolean;
  blocksPointer: boolean;
};

type SettingsMenuElements = {
  panel: HTMLElement | null | undefined;
  overlay?: HTMLElement | null | undefined;
  title?: HTMLElement | null | undefined;
};

export class SettingsMenuService {
  private panel: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private title: HTMLElement | null = null;
  private open = false;
  private activeTab = "game";

  constructor(private readonly document: Document) {}

  attach(elements: SettingsMenuElements): void {
    this.panel = elements.panel ?? null;
    this.overlay = elements.overlay ?? null;
    this.title = elements.title ?? null;
    if (this.panel) {
      this.panel.setAttribute("aria-hidden", this.open ? "false" : "true");
      this.panel.style.display = this.open ? "" : "none";
    }
    this.syncBodyClass();
    this.syncTitle();
  }

  setOpen(open: boolean): void {
    this.open = open;
    if (this.panel) {
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

  snapshot(): SettingsMenuSnapshot {
    return {
      attached: Boolean(this.panel),
      open: this.open,
      activeTab: this.activeTab
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
}
