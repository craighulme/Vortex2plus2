import { readRuntimeDisplaySettings } from "./RuntimeDisplaySettings";
import { matchesKeybind } from "../input/KeybindSettings";
import {
  BOOST_ICON,
  FRIEND_ICON,
  MOD_ICON,
  STAFF_ICON,
  badgeDescription,
  badgeIcon,
  cssUrl,
  escapeAttr,
  escapeHtml
} from "./leaderboard/LeaderboardBadges";
import {
  COSMETICS_RETRY_MS,
  COSMETICS_TTL_MS,
  type LeaderboardCosmeticsRecord,
  cosmeticsFor as readCosmeticsFor,
  isVideoUrl,
  playerPanelBackgroundUrl,
  readCommunityApiBase,
  readLeaderboardCosmeticsCache,
  writeLeaderboardCosmeticsCache
} from "./leaderboard/LeaderboardCosmeticsCache";
import { type MediaTone, estimateMediaTone } from "./leaderboard/LeaderboardMediaTone";

type LeaderboardColumn = { key: string; label: string };
type LeaderboardPlayer = {
  id: number;
  username: string;
  is_staff?: boolean;
  is_moderator?: boolean;
  is_booster?: boolean;
  [key: string]: unknown;
};
type FriendStatus = "none" | "friends" | "request_sent" | "request_received" | string;
type FollowStatus = "following" | "not_following" | string;
type PlatformProfile = {
  id: number;
  username?: string;
  bio?: string;
  createdAt?: string;
  followers?: number | null;
  following?: number | null;
  isStaff?: boolean;
  isModerator?: boolean;
  isBooster?: boolean;
};
type LeaderboardApi = {
  setMyId(id: number): void;
  setColumns(cols: LeaderboardColumn[]): void;
  setPlayers(list: LeaderboardPlayer[]): void;
  addPlayer(player: LeaderboardPlayer): void;
  removePlayer(id: number): void;
  updateStat(id: number, key: string, value: unknown): void;
  batchUpdateStat(updates: Array<{ id: number; key: string; value: unknown }>): void;
  setFriendStatuses(map: Record<string, FriendStatus>): void;
  setFriendStatus(id: number, status: FriendStatus): void;
  setFollowStatus(id: number, status: FollowStatus): void;
  getPlayer(id: number): LeaderboardPlayer | null;
  getPlayers(): LeaderboardPlayer[];
  selectPlayer(playerId: number): void;
  closeFriendPanel(): void;
  show(): void;
  hide(): void;
};
type LeaderboardWindow = Window & {
  Leaderboard?: LeaderboardApi;
  _mpSetFriendStatus?: (id: number, status: FriendStatus) => void;
  Notifications?: {
    friendAccepted?: (username?: string | null) => void;
  };
};
type RuntimeLike = {
  leaderboard: { adopt(api: LeaderboardApi): void };
  community?: {
    onVortexUserProfile?: (handler: (profile: PlatformProfile) => void) => void;
    prefetchVortexUsers?: (ids: number[]) => void;
    getVortexUser?: (id: number) => PlatformProfile | null | undefined;
    requestVortexUser?: (id: number, options?: { priority?: boolean }) => Promise<PlatformProfile | null | undefined>;
  };
};
type PendingCosmeticsRequest = {
  resolve: (records: Record<string, LeaderboardCosmeticsRecord>) => void;
  timer: number;
};

export class LeaderboardDomService {
  mount(runtime: RuntimeLike) {
  const windowRef = window as LeaderboardWindow;
  if (windowRef.Leaderboard) {
    runtime.leaderboard.adopt(windowRef.Leaderboard);
    return;
  }
  const leaderboardRoot = document.getElementById("leaderboard") as HTMLElement;
  const leaderboardBody = document.getElementById("lb-body") as HTMLElement;
  const leaderboardHeaders = document.getElementById("lb-col-headers") as HTMLElement;

  const playerPanel = document.getElementById("lb-player-panel") as HTMLElement;
  const playerNameElem = document.getElementById("lbp-name") as HTMLElement;
  const playerFollowBtn = document.getElementById("lbp-follow-btn") as HTMLButtonElement;
  const playerFriendBtn = document.getElementById("lbp-action-btn") as HTMLButtonElement;
  const playerProfileLink = document.getElementById("lbp-profile-link") as HTMLAnchorElement;
  const playerMetaElem = ensurePlayerMetaElement(playerPanel, document);
  if (!leaderboardRoot || !leaderboardBody || !leaderboardHeaders || !playerPanel || !playerNameElem || !playerFollowBtn || !playerFriendBtn || !playerProfileLink) return;

  let myPlayerId: number | null = null;
  let columns: LeaderboardColumn[] = [];
  let players: LeaderboardPlayer[] = [];
  let leaderboardVisible = true;

  let selectedPlayerId: number | null = null;
  let friendStatusMap: Record<string, FriendStatus> = {};
  let followStatusMap: Record<string, FollowStatus> = {};
  const platformProfiles = new Map<number, PlatformProfile>();

  const cosmetics = readLeaderboardCosmeticsCache(localStorage, document);
  const displaySettings = readRuntimeDisplaySettings(document);
  const communityApiBase = readCommunityApiBase(document);
  let cosmeticsRequestKey = "";
  let cosmeticsRequestAt = 0;
  const cosmeticsBridgeRequests = new Map<string, PendingCosmeticsRequest>();
  const panelMediaToneCache = new Map<string, MediaTone | Promise<MediaTone>>();

  windowRef.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== windowRef) return;
    const message = event.data;
    if (!message || message.source !== "vortex-web-extension" || message.type !== "vortex-web-cosmetics:users") return;
    const pending = cosmeticsBridgeRequests.get(message.requestId);
    if (!pending) return;
    cosmeticsBridgeRequests.delete(message.requestId);
    windowRef.clearTimeout(pending.timer);
    pending.resolve(message.records && typeof message.records === "object" ? message.records : {});
  });

  runtime.community?.onVortexUserProfile?.((profile) => applyPlatformProfile(profile));

  function getBadge(player: LeaderboardPlayer) {
    const profile = platformProfiles.get(Number(player.id));
    if (player.is_staff || profile?.isStaff) return STAFF_ICON;
    if (player.is_moderator || profile?.isModerator) return MOD_ICON;
    if (player.is_booster || profile?.isBooster) return BOOST_ICON;
    return null;
  }

  function writeLocalCosmeticsCache() {
    writeLeaderboardCosmeticsCache(localStorage, cosmetics);
  }

  function cosmeticsFor(playerId: number | string) {
    return readCosmeticsFor(cosmetics, playerId);
  }

  function clearPlayerPanelCosmetics() {
    if (!playerPanel) return;
    playerPanel.classList.remove("lbp-has-cosmetic-bg", "lbp-has-video-bg", "lbp-tone-light", "lbp-tone-dark");
    playerPanel.style.removeProperty("--lbp-bg-image");
    delete playerPanel.dataset.lbpBgUrl;
    const media = playerPanel.querySelector(".lbp-bg-video");
    if (media) media.remove();
  }

  function renderPlayerPanelCosmetics(playerId: number | string) {
    if (!playerPanel) return;
    if (!displaySettings.miniProfileCosmetics) {
      clearPlayerPanelCosmetics();
      return;
    }
    const record = cosmeticsFor(playerId);
    const url = playerPanelBackgroundUrl(record);
    const video = isVideoUrl(url);

    playerPanel.classList.toggle("lbp-has-cosmetic-bg", !!url);
    playerPanel.classList.toggle("lbp-has-video-bg", !!url && video);
    playerPanel.classList.toggle("lbp-tone-dark", !!url);
    playerPanel.classList.remove("lbp-tone-light");
    playerPanel.style.removeProperty("--lbp-bg-image");
    playerPanel.dataset.lbpBgUrl = url;

    let media = playerPanel.querySelector<HTMLVideoElement>(".lbp-bg-video");
    if (!url || !video) {
      if (media) media.remove();
    }
    if (!url) return;

    if (video) {
      if (!media) {
        media = document.createElement("video");
        media.className = "lbp-bg-video";
        media.autoplay = true;
        media.muted = true;
        media.loop = true;
        media.playsInline = true;
        media.setAttribute("aria-hidden", "true");
        playerPanel.insertBefore(media, playerPanel.firstChild);
      }
      if (media.dataset.src !== url) {
        media.dataset.src = url;
        media.src = url;
        media.load?.();
      }
      media.play?.().catch?.(() => {});
      applyPlayerPanelTone(url, media);
      return;
    }

    playerPanel.style.setProperty("--lbp-bg-image", `url("${cssUrl(url)}")`);
    applyPlayerPanelTone(url, null);
  }

  function applyPlayerPanelTone(url: string, media: HTMLVideoElement | null) {
    if (!playerPanel || !url) return;
    const cached = panelMediaToneCache.get(url);
    if (typeof cached === "string") {
      setPlayerPanelTone(url, cached);
      return;
    }
    if (cached) {
      cached.then((tone) => setPlayerPanelTone(url, tone || "dark")).catch(() => setPlayerPanelTone(url, "dark"));
      return;
    }

    const promise = estimateMediaTone(document, url, media)
      .then((tone) => {
        const resolved = tone || "dark";
        panelMediaToneCache.set(url, resolved);
        setPlayerPanelTone(url, resolved);
        return resolved;
      })
      .catch(() => {
        panelMediaToneCache.set(url, "dark");
        setPlayerPanelTone(url, "dark");
        return "dark";
      });
    panelMediaToneCache.set(url, promise as Promise<MediaTone>);
  }

  function setPlayerPanelTone(url: string, tone: MediaTone) {
    if (!playerPanel || playerPanel.dataset.lbpBgUrl !== url) return;
    playerPanel.classList.toggle("lbp-tone-light", tone === "light");
    playerPanel.classList.toggle("lbp-tone-dark", tone !== "light");
  }

  function cleanPlayerName(id: number, value: unknown, previous = "") {
    const raw = String(value || "").trim();
    const profile = platformProfiles.get(Number(id));
    const fallback = previous || profile?.username || `#${id}`;
    if (!raw) return fallback;
    const lower = raw.toLowerCase();
    const idText = String(id);
    if (
      raw === idText ||
      raw === `#${idText}` ||
      lower === `user${idText}` ||
      lower === `#user${idText}` ||
      lower === "browserplayer"
    ) {
      return fallback;
    }
    return raw;
  }

  function isPlaceholderName(id: number, value: unknown) {
    const raw = String(value || "").trim();
    if (!raw) return true;
    const lower = raw.toLowerCase();
    const idText = String(id);
    return raw === idText ||
      raw === `#${idText}` ||
      lower === `user${idText}` ||
      lower === `#user${idText}` ||
      lower === "browserplayer";
  }

  function applyPlatformProfile(profile: PlatformProfile | null | undefined) {
    if (!profile || !profile.id) return;
    platformProfiles.set(Number(profile.id), profile);
    let changed = false;
    for (const player of players) {
      if (Number(player.id) !== Number(profile.id)) continue;
      if (profile.username && isPlaceholderName(player.id, player.username)) {
        player.username = profile.username;
        changed = true;
      }
      if (profile.isStaff && !player.is_staff) {
        player.is_staff = true;
        changed = true;
      }
      if (profile.isModerator && !player.is_moderator) {
        player.is_moderator = true;
        changed = true;
      }
      if (profile.isBooster && !player.is_booster) {
        player.is_booster = true;
        changed = true;
      }
    }
    if (selectedPlayerId === Number(profile.id)) {
      renderPlayerPanelMeta(profile);
      renderPlayerPanelCosmetics(profile.id);
    }
    if (changed) renderLeaderboard();
  }

  function selectedVwBadge(record: LeaderboardCosmeticsRecord | null) {
    return record?.badges?.find((badge) => badge.selected) || null;
  }

  function renderVwBadge(record: LeaderboardCosmeticsRecord | null) {
    if (!displaySettings.leaderboardCosmetics) return "";
    const badge = selectedVwBadge(record);
    if (!badge) return "";
    const classes = [
      "lb-vw-badge",
      `lb-vw-badge-${escapeAttr(badge.kind || "community")}`,
      record?.badgeGradient?.length === 2 ? "lb-has-badge-gradient" : "",
      record?.badgeEffect ? `vw-badge-effect-${escapeAttr(record.badgeEffect)}` : ""
    ].filter(Boolean).join(" ");
    const style = record?.badgeGradient?.length === 2
      ? ` style="--lb-badge-gradient:linear-gradient(135deg, ${escapeAttr(record.badgeGradient[0])}, ${escapeAttr(record.badgeGradient[1])})"`
      : "";
    return `<span class="${classes}"${style} title="${escapeAttr(badgeDescription(badge))}">${badgeIcon(badge.kind)}</span>`;
  }

  function rowCosmeticStyle(record: LeaderboardCosmeticsRecord | null) {
    if (!displaySettings.leaderboardCosmetics) return "";
    if (!record?.nameplateUrl) return "";
    return `--lb-row-nameplate-image:url('${cssUrl(record.nameplateUrl)}')`;
  }

  function renderNameplate(record: LeaderboardCosmeticsRecord | null, safeName: string) {
    if (!displaySettings.leaderboardCosmetics) return `<span class="lb-nameplate"><span class="lb-name-text">${safeName}</span></span>`;
    const styles = [];
    if (record?.nameGradient?.length === 2) {
      styles.push(`--lb-name-color-a:${record.nameGradient[0]}`);
      styles.push(`--lb-name-color-b:${record.nameGradient[1]}`);
      styles.push(`--lb-name-gradient:linear-gradient(90deg, ${record.nameGradient[0]}, ${record.nameGradient[1]})`);
    }
    const styleAttr = styles.length ? ` style="${escapeAttr(styles.join(";"))}"` : "";
    const classes = [
      "lb-nameplate",
      record?.nameGradient?.length === 2 ? "has-gradient" : "",
      record?.nameEffect ? `vw-name-effect-${escapeAttr(record.nameEffect)}` : ""
    ].filter(Boolean).join(" ");
    return `<span class="${classes}"${styleAttr}><span class="lb-name-text">${safeName}</span></span>`;
  }

  function renderLeaderboard() {
    loadCosmeticsForPlayers(players);
    loadPlatformProfilesForPlayers(players);
    leaderboardHeaders.innerHTML = "";

    for (const col of columns) {
      const el = document.createElement("span");
      el.className = "lb-col-label";
      el.textContent = col.label;
      leaderboardHeaders.appendChild(el);
    }

    leaderboardBody.innerHTML = "";

    for (const player of players) {
      const isSelf = player.id === myPlayerId;
      const relation = friendStatusMap[player.id];
      const webRecord = cosmeticsFor(player.id);

      const row = document.createElement("div");
      row.className = [
        "lb-row",
        isSelf ? "lb-self" : "lb-clickable",
        displaySettings.leaderboardCosmetics && webRecord?.nameplateUrl ? "lb-row-nameplate" : ""
      ].filter(Boolean).join(" ");
      const rowStyle = rowCosmeticStyle(webRecord);
      if (rowStyle) row.setAttribute("style", rowStyle);

      if (!isSelf) {
        row.dataset.playerId = String(player.id);
      }

      const nameEl = document.createElement("span");
      nameEl.className = "lb-name";

      const safeName = player.username
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      const platformBadge =
        !isSelf && relation === "friends"
          ? FRIEND_ICON
          : getBadge(player) ?? "";
      const webBadge = renderVwBadge(webRecord);

      nameEl.innerHTML =
        `<span class="lb-badge-slot">${platformBadge}${webBadge}</span>` + renderNameplate(webRecord, safeName);

      row.appendChild(nameEl);

      for (const col of columns) {
        const val = document.createElement("span");
        val.className = "lb-col-val";
        val.textContent =
          player[col.key] != null ? String(player[col.key]) : "-";
        row.appendChild(val);
      }

      leaderboardBody.appendChild(row);
    }
  }

  function updateFollowState(state: FollowStatus, targetId: number) {
    followStatusMap[targetId] = state;

    playerFollowBtn.onclick = null;
    playerFollowBtn.disabled = false;

    if (state === "following") {
      playerFollowBtn.textContent = "Following";
      playerFollowBtn.className = "lbp-btn lbp-following";

      playerFollowBtn.onclick = async () => {
        playerFollowBtn.disabled = true;
        playerFollowBtn.textContent = "...";

        const res = await fetch("/api/follow/" + targetId, {
          method: "DELETE",
        });

        if (selectedPlayerId !== targetId) return;

        updateFollowState(
          res.ok ? "not_following" : "following",
          targetId
        );
      };
    } else {
      playerFollowBtn.textContent = "Follow";
      playerFollowBtn.className = "lbp-btn lbp-add";

      playerFollowBtn.onclick = async () => {
        playerFollowBtn.disabled = true;
        playerFollowBtn.textContent = "...";

        const res = await fetch("/api/follow/" + targetId, {
          method: "POST",
        });

        if (selectedPlayerId !== targetId) return;

        updateFollowState(
          res.ok ? "following" : "not_following",
          targetId
        );
      };
    }
  }

  function loadCosmeticsForPlayers(list: LeaderboardPlayer[]) {
    if (!displaySettings.leaderboardCosmetics && !displaySettings.miniProfileCosmetics) return;
    if (!communityApiBase || !Array.isArray(list) || !list.length) return;
    const ids = [...new Set(list.map((player) => Number(player.id)).filter((id) => Number.isFinite(id) && id > 0))].sort((a, b) => a - b);
    const now = Date.now();
    const missing = ids.filter((id) => {
      const record = cosmetics.records?.[id] || cosmetics.records?.[String(id)];
      const fetchedAt = Number(cosmetics.fetchedAt?.[id] || cosmetics.fetchedAt?.[String(id)] || 0);
      return !record || !fetchedAt || now - fetchedAt > COSMETICS_TTL_MS;
    });
    const key = missing.join(",");
    if (!key || (key === cosmeticsRequestKey && now - cosmeticsRequestAt < COSMETICS_RETRY_MS)) return;
    cosmeticsRequestKey = key;
    cosmeticsRequestAt = now;
    requestCosmeticsFromExtension(missing)
      .then((records) => {
        if (records && Object.keys(records).length) return { records };
        return fetch(`${communityApiBase}/community/profiles?ids=${encodeURIComponent(key)}`, {
      credentials: "omit",
      cache: "no-store",
      headers: { accept: "application/json" }
        }).then((res) => res.ok ? res.json() : null);
      })
      .then((data) => {
        if (!data?.records || typeof data.records !== "object") return;
        cosmetics.records = { ...(cosmetics.records || {}), ...data.records };
        cosmetics.fetchedAt = { ...(cosmetics.fetchedAt || {}) };
        for (const id of missing) {
          cosmetics.fetchedAt[id] = Date.now();
        }
        writeLocalCosmeticsCache();
        if (selectedPlayerId != null) renderPlayerPanelCosmetics(selectedPlayerId);
        renderLeaderboard();
      })
      .catch(() => {});
  }

  function loadPlatformProfilesForPlayers(list: LeaderboardPlayer[]) {
    const ids = [...new Set((Array.isArray(list) ? list : [])
      .filter((player) => needsPlatformProfile(player))
      .map((player) => Number(player.id))
      .filter((id) => Number.isFinite(id) && id > 0))];
    runtime.community?.prefetchVortexUsers?.(ids);
  }

  function needsPlatformProfile(player: Partial<LeaderboardPlayer> | null | undefined) {
    const id = Number(player?.id);
    if (!Number.isFinite(id) || id <= 0) return false;
    if (platformProfiles.has(id) || runtime.community?.getVortexUser?.(id)) return false;
    if (player?.is_staff || player?.is_moderator || player?.is_booster) return false;
    return isPlaceholderName(id, player?.username) || player?.is_staff === undefined || player?.is_moderator === undefined || player?.is_booster === undefined;
  }

  function requestCosmeticsFromExtension(userIds: number[]) {
    return new Promise<Record<string, LeaderboardCosmeticsRecord>>((resolve) => {
      const requestId = `lb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      const timer = window.setTimeout(() => {
        cosmeticsBridgeRequests.delete(requestId);
        resolve({});
      }, 1800);
      cosmeticsBridgeRequests.set(requestId, { resolve, timer });
      window.postMessage({
        source: "vortex-web-page",
        type: "vortex-web-cosmetics:load-users",
        requestId,
        userIds
      }, window.location.origin);
    });
  }

  function openPlayerPanel(playerId: number) {
    if (selectedPlayerId === playerId) {
      selectedPlayerId = null;
      playerPanel.style.display = "none";
      clearPlayerPanelCosmetics();
      return;
    }

    selectedPlayerId = playerId;

    const player = players.find((p) => p.id === playerId);

    playerNameElem.textContent = player?.username ?? "";
    playerProfileLink.href = "/users/" + playerId + "/profile";
    playerPanel.style.display = "";
    renderPlayerPanelCosmetics(playerId);
    renderPlayerPanelMeta(platformProfiles.get(Number(playerId)) || null);
    runtime.community?.requestVortexUser?.(playerId, { priority: true })
      .then((profile) => {
        if (selectedPlayerId !== playerId || !profile) return;
        applyPlatformProfile(profile);
      })
      .catch(() => {});

    updateFriendState(
      friendStatusMap[playerId] ?? "none",
      playerId
    );

    if (followStatusMap[playerId] != null) {
      updateFollowState(followStatusMap[playerId], playerId);
    } else {
      playerFollowBtn.textContent = "...";
      playerFollowBtn.className = "lbp-btn";
      playerFollowBtn.disabled = true;

      fetch("/api/follow/" + playerId)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (selectedPlayerId !== playerId || !data) return;
          updateFollowState(data.status, playerId);
        });
    }
  }

  function renderPlayerPanelMeta(profile: PlatformProfile | null) {
    if (!playerMetaElem) return;
    if (!profile) {
      playerMetaElem.innerHTML = '<div class="lbp-loading">Loading profile...</div>';
      return;
    }
    const rows = [];
    if (profile.bio) rows.push(`<div class="lbp-bio">${escapeHtml(profile.bio)}</div>`);
    if (profile.createdAt) {
      rows.push(`<div><span>Joined</span><b title="${escapeAttr(profile.createdAt)}">${escapeHtml(formatDate(profile.createdAt))}</b></div>`);
    }
    if (profile.followers !== null || profile.following !== null) {
      rows.push(`<div><span>Social</span><b>${formatCount(profile.followers)} followers / ${formatCount(profile.following)} following</b></div>`);
    }
    const role = profile.isStaff ? "Staff" : profile.isModerator ? "Moderator" : profile.isBooster ? "Booster" : "";
    if (role) rows.push(`<div><span>Role</span><b>${escapeHtml(role)}</b></div>`);
    playerMetaElem.innerHTML = rows.length ? rows.join("") : "";
  }

  function formatDate(value: string) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
  }

  function formatCount(value: unknown) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0";
    return new Intl.NumberFormat(undefined, { notation: number >= 10000 ? "compact" : "standard" }).format(number);
  }

  function updateFriendState(state: FriendStatus, targetId: number) {
    friendStatusMap[targetId] = state;

    playerFriendBtn.onclick = null;
    playerFriendBtn.disabled = false;

    if (state === "none") {
      playerFriendBtn.textContent = "Add Friend";
      playerFriendBtn.className = "lbp-btn lbp-add";

      playerFriendBtn.onclick = async () => {
        playerFriendBtn.disabled = true;
        playerFriendBtn.textContent = "...";

        const res = await fetch(
          "/api/friends/request/" + targetId,
          { method: "POST" }
        );

        const json = await res.json().catch(() => ({}));

        if (selectedPlayerId !== targetId) return;

        if (res.ok) {
          if (json.result === "accepted") {
            updateFriendState("friends", targetId);
            windowRef._mpSetFriendStatus?.(targetId, "friends");
            windowRef.Notifications?.friendAccepted(
              json.target_username
            );
          } else {
            updateFriendState("request_sent", targetId);
            windowRef._mpSetFriendStatus?.(
              targetId,
              "request_sent"
            );
          }
          renderLeaderboard();
        } else {
          updateFriendState("none", targetId);
        }
      };
    } else if (state === "friends") {
      playerFriendBtn.textContent = "Friends ✓";
      playerFriendBtn.className = "lbp-btn lbp-friends";
    } else if (state === "request_sent") {
      playerFriendBtn.textContent = "Cancel Request";
      playerFriendBtn.className = "lbp-btn lbp-pending";

      playerFriendBtn.onclick = async () => {
        playerFriendBtn.disabled = true;
        playerFriendBtn.textContent = "...";

        const res = await fetch(
          "/api/friends/request/" + targetId,
          { method: "DELETE" }
        );

        if (selectedPlayerId !== targetId) return;

        if (res.ok) {
          updateFriendState("none", targetId);
          windowRef._mpSetFriendStatus?.(targetId, "none");
          renderLeaderboard();
        } else {
          updateFriendState("request_sent", targetId);
        }
      };
    } else if (state === "request_received") {
      playerFriendBtn.textContent = "Accept Request";
      playerFriendBtn.className = "lbp-btn lbp-add";

      playerFriendBtn.onclick = async () => {
        playerFriendBtn.disabled = true;
        playerFriendBtn.textContent = "...";

        const res = await fetch(
          "/api/friends/requests/incoming"
        );

        const list = await res.json().catch(() => []) as Array<{ id: number; from_user_id: number }>;

        const req = list.find(
          (r: { from_user_id: number }) => r.from_user_id === targetId
        );

        if (selectedPlayerId !== targetId) return;

        if (req) {
          const accept = await fetch(
            "/api/friends/accept/" + req.id,
            { method: "POST" }
          );

          if (accept.ok) {
            updateFriendState("friends", targetId);
            windowRef._mpSetFriendStatus?.(
              targetId,
              "friends"
            );
            windowRef.Notifications?.friendAccepted(
              playerNameElem.textContent
            );
            renderLeaderboard();
            return;
          }
        }

        updateFriendState("request_received", targetId);
      };
    }
  }

  document.addEventListener("keydown", (e) => {
    if (matchesKeybind(e, "playerList")) {
      e.preventDefault();

      leaderboardVisible = !leaderboardVisible;
      leaderboardRoot.classList.toggle("lb-hidden", !leaderboardVisible);

      if (!leaderboardVisible) {
        selectedPlayerId = null;
        playerPanel.style.display = "none";
        clearPlayerPanelCosmetics();
      }
    }
  });

  windowRef.Leaderboard = {
    setMyId(id: number) {
      myPlayerId = id;
      renderLeaderboard();
    },

    setColumns(cols: LeaderboardColumn[]) {
      columns = cols;
      renderLeaderboard();
    },

    setPlayers(list: LeaderboardPlayer[]) {
      players = [...list];
      loadPlatformProfilesForPlayers(players);
      renderLeaderboard();
    },

    addPlayer(player: LeaderboardPlayer) {
      const idx = players.findIndex((p) => p.id === player.id);
      const previous = idx >= 0 ? players[idx] : null;
      const merged = {
        ...(previous || {}),
        ...(player || {}),
        id: player.id,
        username: cleanPlayerName(player.id, player.username, previous?.username)
      };

      if (idx >= 0) players[idx] = merged;
      else players.push(merged);

      if (needsPlatformProfile(merged)) {
        runtime.community?.requestVortexUser?.(merged.id).catch(() => {});
      }
      renderLeaderboard();
    },

    removePlayer(id: number) {
      players = players.filter((p) => p.id !== id);

      if (selectedPlayerId === id) {
        selectedPlayerId = null;
        playerPanel.style.display = "none";
        clearPlayerPanelCosmetics();
      }

      renderLeaderboard();
    },

    updateStat(id: number, key: string, value: unknown) {
      const p = players.find((x) => x.id === id);
      if (p) {
        p[key] = value;
        renderLeaderboard();
      }
    },

    batchUpdateStat(updates: Array<{ id: number; key: string; value: unknown }>) {
      for (const { id, key, value } of updates) {
        const p = players.find((x) => x.id === id);
        if (p) p[key] = value;
      }
      renderLeaderboard();
    },

    setFriendStatuses(map: Record<string, FriendStatus>) {
      friendStatusMap = { ...friendStatusMap, ...map };
      renderLeaderboard();
    },

    setFriendStatus(id: number, status: FriendStatus) {
      friendStatusMap[id] = status;
      renderLeaderboard();
    },

    setFollowStatus(id: number, status: FollowStatus) {
      followStatusMap[id] = status;
      if (selectedPlayerId === id) {
        updateFollowState(status, id);
      }
    },

    getPlayer(id: number) {
      return players.find((p) => p.id === id) || null;
    },

    getPlayers() {
      return [...players];
    },

    selectPlayer: openPlayerPanel,

    closeFriendPanel() {
      selectedPlayerId = null;
      playerPanel.style.display = "none";
      clearPlayerPanelCosmetics();
    },

    show() {
      leaderboardVisible = true;
      leaderboardRoot.classList.remove("lb-hidden");
    },

    hide() {
      leaderboardVisible = false;
      leaderboardRoot.classList.add("lb-hidden");
    },
  };

  runtime.leaderboard.adopt(windowRef.Leaderboard);
  }
}

function ensurePlayerMetaElement(panel: HTMLElement | null, documentRef: Document): HTMLElement | null {
  if (!panel) return null;
  const existing = panel.querySelector<HTMLElement>("#lbp-meta");
  if (existing) return existing;
  const element = documentRef.createElement("div");
  element.id = "lbp-meta";
  element.className = "lbp-meta";
  const profileLink = panel.querySelector<HTMLElement>("#lbp-profile-link");
  if (profileLink) panel.insertBefore(element, profileLink);
  else panel.appendChild(element);
  return element;
}
