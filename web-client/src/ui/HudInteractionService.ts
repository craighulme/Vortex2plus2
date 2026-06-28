import type { LeaderboardApi } from "./LeaderboardService";

export type HudInteractionOptions = {
  cursorOver(element: Element | null | undefined): boolean;
  routeSettingsClick(): boolean;
  chat: {
    isFocused(): boolean;
    deactivate(): void;
    activate(): void;
    send(): void;
  };
  leaderboard: {
    api(): LeaderboardApi;
  };
};

export class HudInteractionService {
  private options: HudInteractionOptions | null = null;

  constructor(private readonly document: Document) {}

  configure(options: HudInteractionOptions): this {
    this.options = options;
    return this;
  }

  routeLockedClick(): boolean {
    const options = this.assertConfigured();
    if (options.routeSettingsClick()) return true;
    if (this.routeTopbar(options)) return true;
    if (this.routeFriendPanel(options)) return true;
    if (this.routeNotificationButton(options)) return true;
    if (this.routeLeaderboardRow(options)) return true;
    if (options.chat.isFocused()) {
      options.chat.deactivate();
      return true;
    }
    if (this.routeChat(options)) return true;
    options.leaderboard.api().closeFriendPanel();
    return false;
  }

  private routeTopbar(options: HudInteractionOptions): boolean {
    const topbar = this.document.getElementById("hud-topbar");
    if (!options.cursorOver(topbar)) return false;
    for (const child of Array.from(topbar?.children ?? [])) {
      if (options.cursorOver(child)) {
        (child as HTMLElement).click();
        return true;
      }
    }
    return true;
  }

  private routeFriendPanel(options: HudInteractionOptions): boolean {
    const panel = this.document.getElementById("lb-player-panel");
    if (!panel || panel.style.display === "none" || !options.cursorOver(panel)) return false;
    for (const child of panel.querySelectorAll("button, a")) {
      if (options.cursorOver(child)) {
        (child as HTMLElement).click();
        return true;
      }
    }
    return true;
  }

  private routeLeaderboardRow(options: HudInteractionOptions): boolean {
    const body = this.document.getElementById("lb-body");
    if (!body) return false;
    for (const row of body.querySelectorAll<HTMLElement>("[data-player-id]")) {
      if (!options.cursorOver(row)) continue;
      const playerId = Number.parseInt(row.dataset.playerId || "", 10);
      if (Number.isFinite(playerId)) options.leaderboard.api().selectPlayer(playerId);
      return true;
    }
    return false;
  }

  private routeNotificationButton(options: HudInteractionOptions): boolean {
    const container = this.document.getElementById("notif-container");
    if (!container || !options.cursorOver(container)) return false;
    for (const button of container.querySelectorAll<HTMLElement>(".notif-btn:not(:disabled), .notif-close")) {
      if (!options.cursorOver(button)) continue;
      button.click();
      return true;
    }
    for (const notification of container.querySelectorAll<HTMLElement>(".notif")) {
      if (options.cursorOver(notification)) return true;
    }
    return true;
  }

  private routeChat(options: HudInteractionOptions): boolean {
    const chatWindow = this.document.getElementById("chat-window");
    if (!chatWindow || chatWindow.classList.contains("hidden") || !options.cursorOver(chatWindow)) return false;
    const sendButton = this.document.getElementById("chat-send");
    if (sendButton && options.cursorOver(sendButton)) {
      options.chat.send();
    } else {
      options.chat.activate();
    }
    return true;
  }

  private assertConfigured(): HudInteractionOptions {
    if (!this.options) throw new Error("HudInteractionService is not configured");
    return this.options;
  }
}
