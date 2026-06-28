import type { FriendStatus } from "../MultiplayerService";

type Message = Record<string, any>;

export type MultiplayerMessageRouterContext = {
  selfId(): number | null;
  setSelfId(id: number): void;
  launchInfo(): Record<string, any> | null;
  setLaunchInfoFromInit(message: Message, username: string): void;
  fallbackGameId(): number;
  displayName(id: unknown, username: unknown): string;
  applyKnownPlayerName(id: unknown, username: unknown): void;
  recordPlayers(source: string, players: unknown[]): void;
  recordProbe(event: Record<string, unknown>): void;
  recordLeave(id: unknown, username: unknown): void;
  hasRemote(id: unknown): boolean;
  getRemote(id: unknown): unknown;
  addRemote(id: unknown, username: unknown, isStaff: unknown, isBooster: unknown, avatarData: unknown): void;
  removeRemote(id: unknown): void;
  decodeRemoteState(playerData: unknown, remote: unknown, source: string): void;
  prefetchAvatarImages(value: unknown): void;
  applyLocalAvatar(value: unknown): void;
  applyAvatarToRemote(remote: unknown, data: unknown): boolean;
  updatePendingShirt(id: unknown, shirtId: unknown): void;
  setLeaderboardSelf(id: unknown): void;
  addLeaderboardPlayer(player: { id: unknown; username: string; is_staff?: unknown; is_booster?: unknown }): void;
  setLeaderboardFriendStatus(id: unknown, status: FriendStatus): void;
  setRuntimeFriendStatus(id: unknown, status: FriendStatus): FriendStatus;
  fetchFriendData(): void;
  startBroadcast(): void;
  kicked(): void;
  openScreen(screenId: unknown, token: unknown): void;
  chat: {
    system(message: string): void;
    systemRed(message: string): void;
    systemPlayer(username: unknown, message: string): void;
    clearPlayerMsg(username: unknown): void;
    message(username: string, message: unknown, self: boolean, isStaff: unknown, isOwner: unknown, isBooster: unknown): void;
    warn(message: string): void;
  };
  bubble(id: unknown, message: unknown): void;
  notifications: {
    friendRequest?(fromId: unknown, username: unknown): void;
    friendRequestCancelled?(fromId: unknown): void;
    friendAccepted?(username: unknown): void;
    followed?(username: unknown): void;
    unfollowed?(username: unknown): void;
  };
};

export class MultiplayerMessageRouter {
  handle(input: unknown, ctx: MultiplayerMessageRouterContext): void {
    if (!input || typeof input !== "object") return;
    const message = input as Message;
    switch (message.type) {
      case "kicked":
        ctx.kicked();
        return;

      case "init":
        this.handleInit(message, ctx);
        return;

      case "join":
        this.handleJoin(message, ctx);
        return;

      case "leave":
        ctx.recordLeave(message.id, message.username);
        ctx.chat.systemPlayer(message.username, `${message.username} left.`);
        ctx.removeRemote(message.id);
        return;

      case "kickbroad":
        ctx.chat.clearPlayerMsg(message.username);
        ctx.chat.systemRed(`${message.username} was kicked by ${message.by}.`);
        ctx.removeRemote(message.id);
        return;

      case "states":
        this.handleStates(message, ctx);
        return;

      case "debug_players":
        ctx.recordPlayers(String(message.source || "debug_players"), Array.isArray(message.players) ? message.players : []);
        return;

      case "debug_packet":
        ctx.recordProbe({ type: "debug_packet", ...message });
        return;

      case "probe_sent":
        ctx.recordProbe({ type: "probe_sent", ...message });
        return;

      case "movement_format":
      case "spoof_avatar_sent":
        ctx.recordProbe({ ...message });
        return;

      case "chat":
        this.handleChat(message, ctx);
        return;

      case "chat_muted":
        ctx.chat.system(`You have been muted for ${message.minutes} minutes by an administrator.`);
        return;

      case "chat_throttled":
        ctx.chat.warn(`Please wait ${message.wait}s before sending another message.`);
        return;

      case "chat_blocked":
        ctx.chat.warn(String(message.msg || ""));
        return;

      case "system":
        ctx.chat.system(String(message.msg || ""));
        return;

      case "system_red":
        ctx.chat.systemRed(String(message.msg || ""));
        return;

      case "shirt_update":
        this.handleShirtUpdate(message, ctx);
        return;

      case "screen_open":
        ctx.openScreen(message.screen_id, message.token);
        return;

      case "friend_request":
        ctx.notifications.friendRequest?.(message.from_id, message.from_username);
        ctx.setRuntimeFriendStatus(message.from_id, "request_received");
        ctx.setLeaderboardFriendStatus(message.from_id, "request_received");
        return;

      case "friend_request_cancelled":
        ctx.notifications.friendRequestCancelled?.(message.from_id);
        ctx.setRuntimeFriendStatus(message.from_id, "none");
        ctx.setLeaderboardFriendStatus(message.from_id, "none");
        return;

      case "friend_accepted":
        ctx.notifications.friendAccepted?.(message.by_username);
        ctx.setRuntimeFriendStatus(message.by_id, "friends");
        ctx.setLeaderboardFriendStatus(message.by_id, "friends");
        return;

      case "followed":
        ctx.notifications.followed?.(message.by_username);
        return;

      case "unfollowed":
        ctx.notifications.unfollowed?.(message.by_username);
        return;
    }
  }

  private handleInit(message: Message, ctx: MultiplayerMessageRouterContext): void {
    const id = Number(message.id);
    ctx.setSelfId(id);
    const selfName = ctx.displayName(id, message.username || ctx.launchInfo()?.username || "You");
    if (!ctx.launchInfo() || ctx.launchInfo()?.localRelayPending) {
      ctx.setLaunchInfoFromInit(message, selfName);
    }
    ctx.setLeaderboardSelf(id);
    ctx.addLeaderboardPlayer({ id, username: selfName, is_staff: message.is_staff, is_booster: message.is_booster });
    const initialPlayers = Array.isArray(message.players) ? message.players : [];
    ctx.recordPlayers("init", [message, ...initialPlayers]);
    ctx.prefetchAvatarImages([message, ...initialPlayers]);
    for (const player of initialPlayers) {
      ctx.addRemote(player.id, player.username, player.is_staff, player.is_booster, player);
    }
    ctx.applyLocalAvatar(message);
    ctx.fetchFriendData();
    ctx.startBroadcast();
  }

  private handleJoin(message: Message, ctx: MultiplayerMessageRouterContext): void {
    if (message.id === ctx.selfId()) return;
    ctx.recordPlayers("join", [message]);
    ctx.prefetchAvatarImages(message);
    ctx.addRemote(message.id, message.username, message.is_staff, message.is_booster, message);
    const joinName = ctx.displayName(message.id, message.username);
    ctx.chat.systemPlayer(joinName, `${joinName} joined.`);
  }

  private handleStates(message: Message, ctx: MultiplayerMessageRouterContext): void {
    const players = Array.isArray(message.players) ? message.players : [];
    ctx.recordPlayers("states", players);
    const avatarPlayers = players.filter((player) => hasAvatarPayload(player));
    if (avatarPlayers.length) ctx.prefetchAvatarImages(avatarPlayers);
    for (const player of players) {
      if (player.id !== ctx.selfId()) {
        ctx.applyKnownPlayerName(player.id, player.username);
      }
      if (player.id !== ctx.selfId() && !ctx.hasRemote(player.id)) {
        ctx.addRemote(player.id, player.username, player.is_staff, player.is_booster, player);
      }
      const remote = ctx.getRemote(player.id);
      if (remote) ctx.decodeRemoteState(player, remote, "states");
    }
  }

  private handleChat(message: Message, ctx: MultiplayerMessageRouterContext): void {
    ctx.applyKnownPlayerName(message.id, message.username);
    if (message.id !== ctx.selfId() && !ctx.hasRemote(message.id)) {
      ctx.addRemote(message.id, message.username, message.is_staff, message.is_booster, {});
    }
    const chatName = ctx.displayName(message.id, message.username);
    ctx.chat.message(chatName, message.msg, message.id === ctx.selfId(), message.is_staff, message.is_owner, message.is_booster);
    ctx.bubble(message.id, message.msg);
  }

  private handleShirtUpdate(message: Message, ctx: MultiplayerMessageRouterContext): void {
    ctx.prefetchAvatarImages(message);
    const remote = ctx.getRemote(message.id);
    if (remote && ctx.applyAvatarToRemote(remote, message)) return;
    ctx.updatePendingShirt(message.id, message.shirt_id);
  }
}

function hasAvatarPayload(player: Message): boolean {
  return player.shirt_id !== undefined ||
    player.pant_id !== undefined ||
    player.body_type !== undefined ||
    player.body_colors !== undefined ||
    player.face_id !== undefined;
}
