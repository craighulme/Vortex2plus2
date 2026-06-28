type WindowWithFriendStatus = Window & {
  _mpSetFriendStatus?: (userId: number, status: string) => void;
};

export type VortexNotificationsApi = {
  friendRequest(userId: number, username: string): void;
  demo(type?: "friend_request" | "friend_accepted" | "followed" | "unfollowed" | "notice", username?: string): void;
  friendRequestCancelled(userId: number): void;
  friendAccepted(username: string): void;
  followed(username: string): void;
  unfollowed(username: string): void;
};

export class NotificationService {
  private readonly activeFriendRequestNotifs = new Map<number, HTMLElement>();
  private readonly activeFriendRequestTimers = new Map<number, number>();

  constructor(private readonly documentRef: Document, private readonly windowRef: WindowWithFriendStatus) {}

  installGlobal(): this {
    this.windowRef.Notifications = {
      friendRequest: (userId, username) => this.friendRequest(userId, username),
      demo: (type, username) => this.demo(type, username),
      friendRequestCancelled: (userId) => this.friendRequestCancelled(userId),
      friendAccepted: (username) => this.friendAccepted(username),
      followed: (username) => this.notice(`${username} followed you`),
      unfollowed: (username) => this.notice(`${username} unfollowed you`)
    };
    (this.windowRef as WindowWithFriendStatus & { VortexNotifications?: VortexNotificationsApi }).VortexNotifications = this.windowRef.Notifications;
    return this;
  }

  demo(type: "friend_request" | "friend_accepted" | "followed" | "unfollowed" | "notice" = "friend_request", username = "DemoUser"): void {
    if (type === "friend_accepted") {
      this.friendAccepted(username);
      return;
    }
    if (type === "followed") {
      this.notice(`${username} followed you`);
      return;
    }
    if (type === "unfollowed") {
      this.notice(`${username} unfollowed you`);
      return;
    }
    if (type === "notice") {
      this.notice(username);
      return;
    }
    this.demoFriendRequest(username);
  }

  friendRequest(userId: number, username: string): void {
    if (this.activeFriendRequestNotifs.has(userId)) return;
    const container = this.container();
    if (!container) return;

    const notifEl = this.documentRef.createElement("div");
    notifEl.className = "notif";
    notifEl.innerHTML = `
      <button class="notif-close" type="button" aria-label="Dismiss notification">×</button>
      <div class="notif-avatar">${escapeHtml(initial(username))}</div>
      <div class="notif-body">
        <div class="notif-title">${escapeHtml(username)}</div>
        <div class="notif-sub">wants to be your friend</div>
        <div class="notif-actions">
          <button class="notif-btn notif-accept">Accept</button>
          <button class="notif-btn notif-decline">Decline</button>
        </div>
      </div>
    `;
    this.consumePointerEvents(notifEl);
    this.activeFriendRequestNotifs.set(userId, notifEl);

    const acceptBtn = notifEl.querySelector<HTMLButtonElement>(".notif-accept");
    const declineBtn = notifEl.querySelector<HTMLButtonElement>(".notif-decline");
    const closeBtn = notifEl.querySelector<HTMLButtonElement>(".notif-close");
    if (!acceptBtn || !declineBtn) return;

    const setPending = () => {
      acceptBtn.disabled = true;
      declineBtn.disabled = true;
      acceptBtn.textContent = "...";
    };

    acceptBtn.addEventListener("click", async () => {
      setPending();
      const request = await this.findIncomingFriendRequest(userId);
      if (request) {
        const acceptRes = await this.windowRef.fetch(`/api/friends/accept/${request.id}`, { method: "POST" });
        if (acceptRes.ok) {
          this.activeFriendRequestNotifs.delete(userId);
          this.clearFriendRequestTimer(userId);
          this.removeElement(notifEl);
          this.friendAccepted(username);
          this.windowRef._mpSetFriendStatus?.(userId, "friends");
          return;
        }
      }
      acceptBtn.disabled = false;
      declineBtn.disabled = false;
      acceptBtn.textContent = "Accept";
    });

    declineBtn.addEventListener("click", async () => {
      declineBtn.disabled = true;
      acceptBtn.disabled = true;
      this.activeFriendRequestNotifs.delete(userId);
      this.clearFriendRequestTimer(userId);
      this.removeElement(notifEl);
      const request = await this.findIncomingFriendRequest(userId);
      if (request) {
        this.windowRef.fetch(`/api/friends/reject/${request.id}`, { method: "POST" }).catch(() => undefined);
      }
    });

    closeBtn?.addEventListener("click", () => {
      this.activeFriendRequestNotifs.delete(userId);
      this.clearFriendRequestTimer(userId);
      this.removeElement(notifEl);
    });

    container.appendChild(notifEl);
    this.activeFriendRequestTimers.set(userId, this.windowRef.setTimeout(() => {
      if (this.activeFriendRequestNotifs.get(userId) !== notifEl) return;
      this.activeFriendRequestNotifs.delete(userId);
      this.activeFriendRequestTimers.delete(userId);
      this.removeElement(notifEl);
    }, 15000));
  }

  friendRequestCancelled(userId: number): void {
    const element = this.activeFriendRequestNotifs.get(userId);
    if (!element) return;
    this.activeFriendRequestNotifs.delete(userId);
    this.clearFriendRequestTimer(userId);
    this.removeElement(element);
  }

  private demoFriendRequest(username: string): void {
    const container = this.container();
    if (!container) return;

    const notifEl = this.documentRef.createElement("div");
    notifEl.className = "notif";
    notifEl.innerHTML = `
      <button class="notif-close" type="button" aria-label="Dismiss notification">×</button>
      <div class="notif-avatar">${escapeHtml(initial(username))}</div>
      <div class="notif-body">
        <div class="notif-title">${escapeHtml(username)}</div>
        <div class="notif-sub">wants to be your friend</div>
        <div class="notif-actions">
          <button class="notif-btn notif-accept">Accept</button>
          <button class="notif-btn notif-decline">Decline</button>
        </div>
      </div>
    `;
    this.consumePointerEvents(notifEl);

    notifEl.querySelector<HTMLButtonElement>(".notif-accept")?.addEventListener("click", () => {
      this.removeElement(notifEl);
      this.friendAccepted(username);
    });
    notifEl.querySelector<HTMLButtonElement>(".notif-decline")?.addEventListener("click", () => {
      this.removeElement(notifEl);
    });
    notifEl.querySelector<HTMLButtonElement>(".notif-close")?.addEventListener("click", () => {
      this.removeElement(notifEl);
    });

    container.appendChild(notifEl);
    this.windowRef.setTimeout(() => this.removeElement(notifEl), 15000);
  }

  friendAccepted(username: string): void {
    const container = this.container();
    if (!container) return;
    const notifEl = this.documentRef.createElement("div");
    notifEl.className = "notif notif-success";
    notifEl.innerHTML = `
      <div class="notif-avatar notif-avatar-success">✓</div>
      <div class="notif-body">
        <div class="notif-title">You're friends!</div>
        <div class="notif-sub">You and ${escapeHtml(username)} are now friends.</div>
      </div>
    `;
    this.consumePointerEvents(notifEl);
    container.appendChild(notifEl);
    this.windowRef.setTimeout(() => this.removeElement(notifEl), 6000);
  }

  notice(message: string): void {
    const container = this.container();
    if (!container) return;
    const notifEl = this.documentRef.createElement("div");
    notifEl.className = "notif notif-success";
    notifEl.innerHTML = `
      <div class="notif-body">
        <div class="notif-title">${escapeHtml(message)}</div>
      </div>
    `;
    this.consumePointerEvents(notifEl);
    container.appendChild(notifEl);
    this.windowRef.setTimeout(() => this.removeElement(notifEl), 5000);
  }

  private async findIncomingFriendRequest(userId: number): Promise<{ id: number } | null> {
    const res = await this.windowRef.fetch("/api/friends/requests/incoming").catch(() => null);
    if (!res?.ok) return null;
    const list = await res.json().catch(() => []) as Array<{ id?: unknown; from_user_id?: unknown }>;
    const request = list.find((entry) => Number(entry.from_user_id) === userId);
    return request?.id ? { id: Number(request.id) } : null;
  }

  private removeElement(element: HTMLElement): void {
    element.classList.add("notif-out");
    this.windowRef.setTimeout(() => element.remove(), 280);
  }

  private clearFriendRequestTimer(userId: number): void {
    const timer = this.activeFriendRequestTimers.get(userId);
    if (timer) this.windowRef.clearTimeout(timer);
    this.activeFriendRequestTimers.delete(userId);
  }

  private container(): HTMLElement | null {
    return this.documentRef.getElementById("notif-container");
  }

  private consumePointerEvents(element: HTMLElement): void {
    for (const type of ["pointerdown", "pointerup", "mousedown", "mouseup", "click"]) {
      element.addEventListener(type, (event) => {
        event.stopPropagation();
      });
    }
  }
}

declare global {
  interface Window {
    Notifications?: VortexNotificationsApi;
    VortexNotifications?: VortexNotificationsApi;
  }
}

function initial(name: string): string {
  return (name[0] || "?").toUpperCase();
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
