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

  function getBadge(player) {
    if (player.is_staff) return STAFF_ICON;
    if (player.is_booster) return BOOST_ICON;
    return null;
  }

  function renderLeaderboard() {
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

      const row = document.createElement("div");
      row.className = "lb-row" + (isSelf ? " lb-self" : " lb-clickable");

      if (!isSelf) {
        row.dataset.playerId = player.id;
      }

      const nameEl = document.createElement("span");
      nameEl.className = "lb-name";

      const safeName = player.username
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      const badge =
        !isSelf && relation === "friends"
          ? FRIEND_ICON
          : getBadge(player) ?? "";

      nameEl.innerHTML =
        `<span class="lb-badge-slot">${badge}</span>` + safeName;

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
})();
