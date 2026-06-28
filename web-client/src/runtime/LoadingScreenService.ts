export class LoadingScreenService {
  private screen: HTMLElement | null = null;
  private logo: HTMLElement | null = null;
  private barBg: HTMLElement | null = null;
  private barFill: HTMLElement | null = null;
  private text: HTMLElement | null = null;
  private completed = false;

  constructor(private readonly documentRef: Document) {}

  mount(title = "VORTEX WEB"): void {
    if (this.screen) return;
    this.screen = this.documentRef.createElement("div");
    this.screen.id = "loadingScreen";
    this.logo = this.documentRef.createElement("div");
    this.logo.id = "loadingLogo";
    this.logo.textContent = title;
    this.barBg = this.documentRef.createElement("div");
    this.barBg.id = "loadingBarBg";
    this.barFill = this.documentRef.createElement("div");
    this.barFill.id = "loadingBarFill";
    this.text = this.documentRef.createElement("div");
    this.text.id = "loadingText";
    this.barBg.appendChild(this.barFill);
    this.screen.append(this.logo, this.barBg);
    this.documentRef.body.appendChild(this.screen);
  }

  attachThreeLoadingManager(manager: {
    onStart?: unknown;
    onProgress?: unknown;
    onLoad?: unknown;
  }): void {
    manager.onStart = () => {
      if (!this.completed) this.show();
    };
    manager.onProgress = (_url: string, loaded: number, total: number) => {
      if (this.completed) return;
      this.setProgress(total > 0 ? loaded / total : 0);
      if (loaded >= total) this.complete();
    };
    manager.onLoad = () => undefined;
  }

  setText(message: string): void {
    this.mount();
    if (!this.text || !this.screen) return;
    this.text.textContent = message;
    if (!this.text.parentNode) this.screen.appendChild(this.text);
  }

  setProgress(value: number): void {
    if (!this.barFill) return;
    this.barFill.style.width = `${Math.max(0, Math.min(1, Number(value) || 0)) * 100}%`;
  }

  show(): void {
    this.mount();
    this.screen?.classList.remove("hidden");
  }

  complete(): void {
    this.completed = true;
    this.screen?.classList.add("hidden");
  }

  snapshot(): { mounted: boolean; completed: boolean } {
    return { mounted: Boolean(this.screen), completed: this.completed };
  }
}
