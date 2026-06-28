type ChatApi = {
  message(username: string, text: string, isSelf?: boolean, isStaff?: boolean, isOwner?: boolean): void;
  system(text: string): void;
  systemPlayer(username: string, text: string, isSelf?: boolean): void;
  systemRed(text: string): void;
  clearPlayerMsg(username?: string): void;
  warn(text: string): void;
  open(): void;
  close(): void;
  activate(): void;
  deactivate(): void;
  isActive(): boolean;
  send(): void;
};

type ChatWindow = Window & {
  Chat?: ChatApi;
  _chatFocused?: boolean;
  _mpHandleChatCommand?: (text: string) => boolean;
  _mpSendChat?: (text: string) => void;
};

const NAME_COLORS = ["#60a5fa", "#34d399", "#f87171", "#fbbf24", "#a78bfa", "#fb923c", "#f472b6"];

export class ChatService {
  private apiObject: ChatApi | null = null;
  private mounted = false;
  private isOpen = true;
  private unread = 0;
  private value = "";
  private selectionAnchor = 0;
  private selectionFocus = 0;
  private active = false;
  private warnTimer: number | null = null;

  constructor(
    private readonly document: Document,
    private readonly windowRef: ChatWindow
  ) {}

  mount(): boolean {
    if (this.mounted) return true;
    const chatWindow = this.document.getElementById("chat-window");
    const messagesEl = this.document.getElementById("chat-messages");
    const inputEl = this.document.getElementById("chat-input");
    const sendBtn = this.document.getElementById("chat-send");
    const toggleBtn = this.document.getElementById("chat-toggle-btn");
    const badge = this.document.getElementById("unread-badge");
    if (!chatWindow || !messagesEl || !inputEl || !sendBtn || !toggleBtn || !badge) return false;

    const warnEl = this.document.createElement("div");
    warnEl.className = "chat-warn hidden";
    chatWindow.appendChild(warnEl);

    const renderDisplay = () => {
      const start = this.selectionStart();
      const end = this.selectionEnd();
      if (!this.value && !this.active) {
        inputEl.innerHTML = '<span class="chat-placeholder">Click or press / to chat</span>';
        return;
      }

      if (this.hasSelection()) {
        inputEl.innerHTML = [
          escapeHtml(this.value.slice(0, start)),
          `<span class="chat-sel">${escapeHtml(this.value.slice(start, end))}</span>`,
          escapeHtml(this.value.slice(end))
        ].join("");
        return;
      }

      const pos = this.selectionFocus;
      inputEl.innerHTML = [
        escapeHtml(this.value.slice(0, pos)),
        this.active ? '<span class="chat-caret"></span>' : "",
        escapeHtml(this.value.slice(pos))
      ].join("");
    };

    const scrollBottom = () => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    };

    const append = (html: string) => {
      const atBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 60;
      const tmp = this.document.createElement("div");
      tmp.innerHTML = html;
      const first = tmp.firstChild;
      if (first) messagesEl.appendChild(first);
      if (atBottom) scrollBottom();
      if (!this.isOpen) {
        this.unread = Math.min(this.unread + 1, 99);
        badge.textContent = this.unread >= 99 ? "99+" : String(this.unread);
        badge.classList.remove("hidden");
      }
    };

    const insertText = (text: string) => {
      const start = this.selectionStart();
      const end = this.selectionEnd();
      this.value = this.value.slice(0, start) + text + this.value.slice(end);
      this.selectionAnchor = this.selectionFocus = this.clamp(start + text.length);
      renderDisplay();
    };

    const deleteRange = (start: number, end: number) => {
      this.value = this.value.slice(0, start) + this.value.slice(end);
      this.selectionAnchor = this.selectionFocus = this.clamp(start);
      renderDisplay();
    };

    const activate = () => {
      if (!this.isOpen) open();
      this.active = true;
      this.windowRef._chatFocused = true;
      inputEl.classList.add("chat-active");
      renderDisplay();
    };

    const deactivate = () => {
      this.active = false;
      this.windowRef._chatFocused = false;
      inputEl.classList.remove("chat-active");
      renderDisplay();
    };

    const open = () => {
      this.isOpen = true;
      chatWindow.classList.remove("hidden");
      this.unread = 0;
      badge.classList.add("hidden");
      scrollBottom();
    };

    const close = () => {
      this.isOpen = false;
      chatWindow.classList.add("hidden");
      deactivate();
    };

    const send = () => {
      const text = this.value.trim();
      if (!text) {
        deactivate();
        return;
      }
      if (this.windowRef._mpHandleChatCommand?.(text)) {
        this.value = "";
        this.selectionAnchor = this.selectionFocus = 0;
        deactivate();
        return;
      }
      this.windowRef._mpSendChat?.(text);
      this.value = "";
      this.selectionAnchor = this.selectionFocus = 0;
      deactivate();
    };

    toggleBtn.addEventListener("click", () => this.isOpen ? close() : open());
    sendBtn.addEventListener("click", send);

    this.document.addEventListener("keydown", (event) => {
      if (this.document.pointerLockElement && !this.active && event.key === "/") {
        event.preventDefault();
        activate();
        return;
      }
      if (!this.active) return;
      event.stopPropagation();

      const ctrl = event.ctrlKey || event.metaKey;
      if (event.key === "Enter") {
        event.preventDefault();
        send();
      } else if (event.key === "Escape") {
        event.preventDefault();
        deactivate();
      } else if (ctrl && event.key.toLowerCase() === "a") {
        event.preventDefault();
        this.selectionAnchor = 0;
        this.selectionFocus = this.value.length;
        renderDisplay();
      } else if (ctrl && event.key.toLowerCase() === "c") {
        if (this.hasSelection()) this.windowRef.navigator.clipboard?.writeText(this.value.slice(this.selectionStart(), this.selectionEnd())).catch(() => {});
      } else if (ctrl && event.key.toLowerCase() === "x") {
        event.preventDefault();
        if (this.hasSelection()) {
          this.windowRef.navigator.clipboard?.writeText(this.value.slice(this.selectionStart(), this.selectionEnd())).catch(() => {});
          deleteRange(this.selectionStart(), this.selectionEnd());
        }
      } else if (ctrl && event.key.toLowerCase() === "v") {
        event.preventDefault();
        this.windowRef.navigator.clipboard?.readText()
          .then((text) => insertText(text.replace(/[\n\r]/g, " ").slice(0, 200 - (this.value.length - (this.selectionEnd() - this.selectionStart())))))
          .catch(() => {});
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (event.shiftKey) this.selectionFocus = this.clamp(this.selectionFocus - 1);
        else this.selectionAnchor = this.selectionFocus = this.hasSelection() ? this.selectionStart() : this.clamp(this.selectionFocus - 1);
        renderDisplay();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        if (event.shiftKey) this.selectionFocus = this.clamp(this.selectionFocus + 1);
        else this.selectionAnchor = this.selectionFocus = this.hasSelection() ? this.selectionEnd() : this.clamp(this.selectionFocus + 1);
        renderDisplay();
      } else if (event.key === "Home") {
        event.preventDefault();
        if (event.shiftKey) this.selectionFocus = 0;
        else this.selectionAnchor = this.selectionFocus = 0;
        renderDisplay();
      } else if (event.key === "End") {
        event.preventDefault();
        if (event.shiftKey) this.selectionFocus = this.value.length;
        else this.selectionAnchor = this.selectionFocus = this.value.length;
        renderDisplay();
      } else if (event.key === "Backspace") {
        event.preventDefault();
        if (this.hasSelection()) deleteRange(this.selectionStart(), this.selectionEnd());
        else if (this.selectionFocus > 0) deleteRange(this.selectionFocus - 1, this.selectionFocus);
      } else if (event.key === "Delete") {
        event.preventDefault();
        if (this.hasSelection()) deleteRange(this.selectionStart(), this.selectionEnd());
        else if (this.selectionFocus < this.value.length) deleteRange(this.selectionFocus, this.selectionFocus + 1);
      } else if (!ctrl && event.key.length === 1) {
        event.preventDefault();
        const remaining = 200 - (this.value.length - (this.selectionEnd() - this.selectionStart()));
        if (remaining > 0) insertText(event.key);
      }
    }, true);

    this.apiObject = {
      message: (username, text, isSelf, isStaff, isOwner) => {
        const safeName = escapeHtml(username);
        let nameHtml: string;
        if (isOwner) nameHtml = `<span class="msg-name msg-gradient-owner">${safeName}</span>`;
        else if (isStaff) nameHtml = `<span class="msg-name msg-gradient-staff">${safeName}</span>`;
        else nameHtml = `<span class="msg-name" style="color:${isSelf ? "#fff" : nameColor(username)}">${safeName}</span>`;
        append(`<div class="msg${isSelf ? " msg-self" : ""}">${nameHtml}: <span class="msg-text">${escapeHtml(text)}</span></div>`);
      },
      system: (text) => append(`<div class="msg-system">${escapeHtml(text)}</div>`),
      systemPlayer: (username, text) => append(`<div class="msg-system">${escapeHtml(text).replace(escapeHtml(username), `<b>${escapeHtml(username)}</b>`)}</div>`),
      systemRed: (text) => append(`<div class="msg-system-red">${escapeHtml(text)}</div>`),
      clearPlayerMsg: () => {},
      warn: (text) => {
        warnEl.textContent = text;
        warnEl.classList.remove("hidden");
        if (this.warnTimer !== null) this.windowRef.clearTimeout(this.warnTimer);
        this.warnTimer = this.windowRef.setTimeout(() => warnEl.classList.add("hidden"), 3000);
      },
      open,
      close,
      activate,
      deactivate,
      isActive: () => this.active,
      send
    };

    this.windowRef.Chat = this.apiObject;
    this.mounted = true;
    renderDisplay();
    return true;
  }

  api(): ChatApi | null {
    return this.apiObject;
  }

  snapshot(): { mounted: boolean; open: boolean; active: boolean; unread: number } {
    return {
      mounted: this.mounted,
      open: this.isOpen,
      active: this.active,
      unread: this.unread
    };
  }

  private selectionStart(): number {
    return Math.min(this.selectionAnchor, this.selectionFocus);
  }

  private selectionEnd(): number {
    return Math.max(this.selectionAnchor, this.selectionFocus);
  }

  private hasSelection(): boolean {
    return this.selectionAnchor !== this.selectionFocus;
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(this.value.length, value));
  }
}

function nameColor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) & 0xffff;
  return NAME_COLORS[hash % NAME_COLORS.length] ?? "#60a5fa";
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
