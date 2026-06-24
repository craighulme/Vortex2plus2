(() => {
  const leaderboardRoot = document.getElementById("leaderboard");
  const leaderboardBody = document.getElementById("lb-body");
  const leaderboardHeaders = document.getElementById("lb-col-headers");

  const playerPanel = document.getElementById("lb-player-panel");
  const playerNameElem = document.getElementById("lbp-name");
  const playerFollowBtn = document.getElementById("lbp-follow-btn");
  const playerFriendBtn = document.getElementById("lbp-action-btn");
  const playerProfileLink = document.getElementById("lbp-profile-link");

  let myPlayerId = null;
  let columns = [];
  let players = [];
  let leaderboardVisible = true;

  let selectedPlayerId = null;
  let friendStatusMap = {};
  let followStatusMap = {};

  const FRIEND_ICON = '<i class="fa-solid fa-user lb-friend-icon"></i>';
  const STAFF_ICON = '<i class="fa-solid fa-shield-halved lb-staff-icon"></i>';
  const BOOST_ICON =
    '<svg class="lb-boost-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><path fill="#FF4DA5" d="M12.4801 1.42383C12.202 1.19206 11.798 1.19206 11.5199 1.42383L5.51986 6.42383C5.34887 6.56633 5.25 6.77742 5.25 7V17C5.25 17.2226 5.34887 17.4337 5.51986 17.5762L11.5199 22.5762C11.798 22.8079 12.202 22.8079 12.4801 22.5762L18.4801 17.5762C18.6511 17.4337 18.75 17.2226 18.75 17V7C18.75 6.77742 18.6511 6.56633 18.4801 6.42383L12.4801 1.42383Z"/><path fill="#ECEFF1" fill-rule="evenodd" d="M11.4932 5.44713C11.7799 5.18429 12.2201 5.18429 12.5068 5.44713L15.5068 8.19713C15.6618 8.33919 15.75 8.53977 15.75 8.75V15.25C15.75 15.4602 15.6618 15.6608 15.5068 15.8029L12.5068 18.5529C12.2201 18.8157 11.7799 18.8157 11.4932 18.5529L8.49321 15.8029C8.33823 15.6608 8.25 15.4602 8.25 15.25V8.75C8.25 8.53977 8.33823 8.33919 8.49321 8.19713L11.4932 5.44713ZM9.75 9.07993V14.9201L12 16.9826L14.25 14.9201V9.07993L12 7.01743L9.75 9.07993Z" clip-rule="evenodd"/><path fill="#E54594" fill-rule="evenodd" d="M12 1.25V22.75C11.8295 22.75 11.6589 22.6921 11.5199 22.5762L5.51986 17.5762C5.34887 17.4337 5.25 17.2226 5.25 17V7C5.25 6.77742 5.34887 6.56633 5.51986 6.42383L11.5199 1.42383C11.6589 1.30794 11.8295 1.25 12 1.25Z" clip-rule="evenodd"/><path fill="#D4D6D8" fill-rule="evenodd" d="M12 5.25C11.8183 5.25 11.6366 5.31571 11.4932 5.44713L8.49321 8.19713C8.33823 8.33919 8.25 8.53977 8.25 8.75V15.25C8.25 15.4602 8.33823 15.6608 8.49321 15.8029L11.4932 18.5529C11.6366 18.6843 11.8183 18.75 12 18.75V16.9826L9.75 14.9201V9.07993L12 7.01743V5.25Z" clip-rule="evenodd"/></svg>';
  const cosmetics = readCosmetics();
  const communityApiBase = readCommunityApiBase();
  let cosmeticsRequestKey = "";

  function getBadge(player) {
    if (player.is_staff) return STAFF_ICON;
    if (player.is_booster) return BOOST_ICON;
    return null;
  }

  function readCosmetics() {
    const meta = document.getElementById("_vortexWebCosmetics");
    if (!meta?.content) return { records: {} };
    try {
      const parsed = JSON.parse(meta.content);
      return parsed && typeof parsed === "object" ? parsed : { records: {} };
    } catch {
      return { records: {} };
    }
  }

  function readCommunityApiBase() {
    const meta = document.getElementById("_vortexCommunityApi");
    if (!meta?.content) return "https://v22.irongiant.vip";
    try {
      const parsed = JSON.parse(meta.content);
      return String(parsed || "https://v22.irongiant.vip").replace(/\/+$/, "");
    } catch {
      return "https://v22.irongiant.vip";
    }
  }

  function cosmeticsFor(playerId) {
    return cosmetics.records?.[playerId] || cosmetics.records?.[String(playerId)] || null;
  }

  function selectedVwBadge(record) {
    return record?.badges?.find((badge) => badge.selected) || record?.badges?.[0] || null;
  }

  function renderVwBadge(record) {
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

  function rowCosmeticStyle(record) {
    if (!record?.nameplateUrl) return "";
    return `--lb-row-nameplate-image:url('${cssUrl(record.nameplateUrl)}')`;
  }

  function renderNameplate(record, safeName) {
    const styles = [];
    if (record?.nameGradient?.length === 2) {
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
        webRecord?.nameplateUrl ? "lb-row-nameplate" : ""
      ].filter(Boolean).join(" ");
      const rowStyle = rowCosmeticStyle(webRecord);
      if (rowStyle) row.setAttribute("style", rowStyle);

      if (!isSelf) {
        row.dataset.playerId = player.id;
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
          player[col.key] != null ? player[col.key] : "—";
        row.appendChild(val);
      }

      leaderboardBody.appendChild(row);
    }
  }

  function updateFollowState(state, targetId) {
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

  function loadCosmeticsForPlayers(list) {
    if (!communityApiBase || !Array.isArray(list) || !list.length) return;
    const ids = [...new Set(list.map((player) => Number(player.id)).filter((id) => Number.isFinite(id) && id > 0))].sort((a, b) => a - b);
    const missing = ids.filter((id) => !cosmetics.records?.[id] && !cosmetics.records?.[String(id)]);
    const key = missing.join(",");
    if (!key || key === cosmeticsRequestKey) return;
    cosmeticsRequestKey = key;
    fetch(`${communityApiBase}/community/profiles?ids=${encodeURIComponent(key)}`, {
      credentials: "omit",
      cache: "no-store",
      headers: { accept: "application/json" }
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!data?.records || typeof data.records !== "object") return;
        cosmetics.records = { ...(cosmetics.records || {}), ...data.records };
        renderLeaderboard();
      })
      .catch(() => {});
  }

  function cssUrl(value) {
    return String(value || "").replace(/["'\\\n\r]/g, "");
  }

  function badgeDescription(badge) {
    const kind = String(badge?.kind || "community");
    if (kind === "developer") return "Project developer badge";
    if (kind === "sponsor") return "Monthly project sponsor badge";
    if (kind === "supporter") return "One-time project supporter badge";
    if (kind === "contributor") return "Code, design, testing, or community contribution badge";
    return "Community recognition badge";
  }

  function badgeIcon(kind) {
    if (kind === "developer") return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.7 16.9 3.8 12l4.9-4.9 1.4 1.4L6.6 12l3.5 3.5-1.4 1.4Zm6.6 0-1.4-1.4 3.5-3.5-3.5-3.5 1.4-1.4 4.9 4.9-4.9 4.9Zm-4.1 2.2-1.9-.6 3.5-13.6 1.9.6-3.5 13.6Z"/></svg>';
    if (kind === "sponsor") return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 2.9 6 6.6.9-4.8 4.7 1.1 6.6L12 17.1l-5.8 3.1 1.1-6.6-4.8-4.7 6.6-.9L12 2Z"/></svg>';
    if (kind === "supporter") return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.5-9.1C1.1 8.8 3 5.5 6.4 5.5c2 0 3.3 1.1 4.1 2.2.8-1.1 2.1-2.2 4.1-2.2 3.4 0 5.3 3.3 3.9 6.4C16.5 16.4 12 21 12 21Z"/></svg>';
    if (kind === "contributor") return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v3h3v10h-3v3H7v-3H4V7h3V4Zm2 2v3H6v6h3v3h6v-3h3V9h-3V6H9Zm2 4h2v2h2v2h-2v2h-2v-2H9v-2h2v-2Z"/></svg>';
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 20 8v8l-8 4.5L4 16V8l8-4.5Zm0 2.3L6 9.2v5.6l6 3.4 6-3.4V9.2l-6-3.4Zm0 3.2 3 1.7v3.6L12 16l-3-1.7v-3.6L12 9Z"/></svg>';
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  function openPlayerPanel(playerId) {
    if (selectedPlayerId === playerId) {
      selectedPlayerId = null;
      playerPanel.style.display = "none";
      return;
    }

    selectedPlayerId = playerId;

    const player = players.find((p) => p.id === playerId);

    playerNameElem.textContent = player?.username ?? "";
    playerProfileLink.href = "/users/" + playerId + "/profile";
    playerPanel.style.display = "";

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

  function updateFriendState(state, targetId) {
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
            window._mpSetFriendStatus?.(targetId, "friends");
            window.Notifications?.friendAccepted(
              json.target_username
            );
          } else {
            updateFriendState("request_sent", targetId);
            window._mpSetFriendStatus?.(
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
          window._mpSetFriendStatus?.(targetId, "none");
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

        const list = await res.json().catch(() => []);

        const req = list.find(
          (r) => r.from_user_id === targetId
        );

        if (selectedPlayerId !== targetId) return;

        if (req) {
          const accept = await fetch(
            "/api/friends/accept/" + req.id,
            { method: "POST" }
          );

          if (accept.ok) {
            updateFriendState("friends", targetId);
            window._mpSetFriendStatus?.(
              targetId,
              "friends"
            );
            window.Notifications?.friendAccepted(
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
    if (e.code === "Tab") {
      e.preventDefault();

      leaderboardVisible = !leaderboardVisible;
      leaderboardRoot.style.display = leaderboardVisible
        ? ""
        : "none";

      if (!leaderboardVisible) {
        selectedPlayerId = null;
        playerPanel.style.display = "none";
      }
    }
  });

  window.Leaderboard = {
    setMyId(id) {
      myPlayerId = id;
      renderLeaderboard();
    },

    setColumns(cols) {
      columns = cols;
      renderLeaderboard();
    },

    setPlayers(list) {
      players = [...list];
      renderLeaderboard();
    },

    addPlayer(player) {
      const idx = players.findIndex((p) => p.id === player.id);

      if (idx >= 0) players[idx] = player;
      else players.push(player);

      renderLeaderboard();
    },

    removePlayer(id) {
      players = players.filter((p) => p.id !== id);

      if (selectedPlayerId === id) {
        selectedPlayerId = null;
        playerPanel.style.display = "none";
      }

      renderLeaderboard();
    },

    updateStat(id, key, value) {
      const p = players.find((x) => x.id === id);
      if (p) {
        p[key] = value;
        renderLeaderboard();
      }
    },

    batchUpdateStat(updates) {
      for (const { id, key, value } of updates) {
        const p = players.find((x) => x.id === id);
        if (p) p[key] = value;
      }
      renderLeaderboard();
    },

    setFriendStatuses(map) {
      friendStatusMap = { ...friendStatusMap, ...map };
      renderLeaderboard();
    },

    setFriendStatus(id, status) {
      friendStatusMap[id] = status;
      renderLeaderboard();
    },

    setFollowStatus(id, status) {
      followStatusMap[id] = status;
      if (selectedPlayerId === id) {
        updateFollowState(status, id);
      }
    },

    getPlayer(id) {
      return players.find((p) => p.id === id) || null;
    },

    getPlayers() {
      return [...players];
    },

    selectPlayer: openPlayerPanel,

    closeFriendPanel() {
      selectedPlayerId = null;
      playerPanel.style.display = "none";
    },

    show() {
      leaderboardVisible = true;
      leaderboardRoot.style.display = "";
    },

    hide() {
      leaderboardVisible = false;
      leaderboardRoot.style.display = "none";
    },
  };

  window.VortexRuntime?.leaderboard?.adopt?.(window.Leaderboard);
})();
