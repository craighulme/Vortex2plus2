(function bootProfileCosmetics(attempt = 0) {
  const api = globalThis.VortexWebCosmetics;
  if (!api) {
    if (attempt < 80) window.setTimeout(() => bootProfileCosmetics(attempt + 1), 100);
    return;
  }
  if (globalThis.__VortexProfileCosmeticsStarted) return;
  globalThis.__VortexProfileCosmeticsStarted = true;
  document.documentElement.dataset.vwProfileScript = "20260624-stable-actions";

  const PROFILE_RE = /\/users\/(\d+)\/profile\/?$/;
  const EFFECT_CLASSES = [
    "vw-name-effect-flow",
    "vw-name-effect-holo",
    "vw-name-effect-neon",
    "vw-name-effect-toxic",
    "vw-name-effect-glitch",
    "vw-name-effect-aurora",
    "vw-name-effect-prism",
    "vw-name-effect-ember",
    "vw-name-effect-phantasm",
    "vw-name-effect-noxious",
    "vw-name-effect-pulse",
    "vw-name-effect-frost",
    "vw-name-effect-solar",
    "vw-name-effect-void",
    "vw-name-effect-static"
  ];
  const BADGE_EFFECT_CLASSES = [
    "vw-badge-effect-shine",
    "vw-badge-effect-phantasm",
    "vw-badge-effect-toxic",
    "vw-badge-effect-pulse"
  ];

  let renderTimer = 0;
  let lastRenderKey = "";
  let profileObserver = null;
  let currentProfileRender = null;
  let lastProfilePointerAction = { key: "", at: 0 };
  const mediaToneCache = new Map();
  const renderRetries = new Map();
  const PROFILE_RENDER_RETRY_MS = 500;
  const PROFILE_RENDER_MAX_RETRIES = 5;
  if (PROFILE_RE.test(location.pathname)) {
    document.documentElement.classList.add("vw-profile-cosmetics-pending");
    window.setTimeout(markCosmeticsReady, 2400);
  }

  function profileUserId() {
    const match = location.pathname.match(PROFILE_RE);
    return match ? Number(match[1]) : null;
  }

  function scheduleRender(force = false) {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => {
      renderProfile(force).catch((error) => {
        setProfileStatus("error");
        console.warn("[vortex-web-profile] render failed", error);
        markCosmeticsReady();
      });
    }, 80);
  }

  function startProfileDomObserver() {
    if (profileObserver) return;
    profileObserver = new MutationObserver((mutations) => {
      if (!PROFILE_RE.test(location.pathname)) return;
      if (!shouldRerenderForProfileMutation(mutations)) return;
      const profile = findProfileElements();
      if (!profile.header || !profile.username) {
        lastRenderKey = "";
        return;
      }
      if (isCosmeticsMissing(profile)) {
        lastRenderKey = "";
        scheduleRender(true);
      }
    });
    profileObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function shouldRerenderForProfileMutation(mutations) {
    for (const mutation of mutations) {
      if (isInsideCosmetics(mutation.target)) continue;
      const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
      if (nodes.some(isProfileNode)) return true;
    }
    return false;
  }

  function isCosmeticsMissing(profile) {
    if (!profile.username.querySelector(".vw-profile-name-text")) return true;
    if (document.documentElement.dataset.vwProfileCosmetics === "ready" && !document.getElementById("vortex-web-profile-badges")) return true;
    if (detectOwnProfile(profile) && !document.getElementById("vortex-web-profile-style")) return true;
    return false;
  }

  function isInsideCosmetics(node) {
    const selector = "#vortex-web-profile-badges, #vortex-web-profile-style, #vortex-web-profile-background, .vw-profile-selected-badge, .vw-profile-nameplate-media";
    return !!node?.closest?.(selector) || !!node?.matches?.(selector);
  }

  function isProfileNode(node) {
    const selector = ".profile-header, .profile-username, [data-profile-username], .profile-name";
    return !!node?.matches?.(selector) || !!node?.querySelector?.(selector);
  }

  async function renderProfile(force = false) {
    const userId = profileUserId();
    if (!userId || !document.body) return;

    const profile = findProfileElements();
    if (!profile.header || !profile.username) {
      lastRenderKey = "";
      return;
    }

    const cachedState = api.loadCached ? await api.loadCached() : { ownUserId: null, records: {} };
    const state = await withTimeout(api.load(), 1500).catch(() => cachedState);
    const cachedRecord = state.records[userId] || cachedState.records?.[userId] || null;
    const cacheFresh = isProfileCacheFresh(state, cachedState, userId);
    const loadedRecord = cachedRecord || cacheFresh
      ? null
      : api.loadUser ? await withTimeout(api.loadUser(userId), 2000).catch(() => null) : null;
    const isOwnProfile = state.ownUserId === userId || detectOwnProfile(profile);
    const record = loadedRecord || cachedRecord || null;
    if (!record && !cacheFresh && shouldRetryProfileRender(userId)) {
      setProfileStatus("retrying");
      window.setTimeout(() => {
        lastRenderKey = "";
        scheduleRender(true);
      }, PROFILE_RENDER_RETRY_MS);
      return;
    }
    if (record) renderRetries.delete(userId);
    setProfileStatus(record ? "ready" : "empty");
    applyProfileRender(profile, userId, record, isOwnProfile, force);
    markCosmeticsReady();
  }

  function setProfileStatus(status) {
    document.documentElement.dataset.vwProfileCosmetics = status;
  }

  function isProfileCacheFresh(state, cachedState, userId) {
    const ttl = Number(state.cacheTtlMs || cachedState.cacheTtlMs || 0);
    const fetchedAt = Number(state.fetchedAt?.[userId] || cachedState.fetchedAt?.[userId] || 0);
    return !!ttl && !!fetchedAt && Date.now() - fetchedAt <= ttl;
  }

  function shouldRetryProfileRender(userId) {
    const attempts = Number(renderRetries.get(userId) || 0);
    if (attempts >= PROFILE_RENDER_MAX_RETRIES) {
      renderRetries.delete(userId);
      return false;
    }
    renderRetries.set(userId, attempts + 1);
    return true;
  }

  function withTimeout(promise, timeoutMs) {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error("timeout")), timeoutMs);
      Promise.resolve(promise)
        .then((value) => {
          window.clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          window.clearTimeout(timer);
          reject(error);
        });
    });
  }

  function applyProfileRender(profile, userId, record, isOwnProfile, force = false) {
    currentProfileRender = { userId, record, isOwnProfile };
    const renderKey = JSON.stringify({
      userId,
      own: isOwnProfile,
      record,
      username: cleanHeadingText(profile.username)
    });
    if (!force && renderKey === lastRenderKey) return;
    lastRenderKey = renderKey;

    decorateHeader(profile, record);
    if (isProfilePanelOpen(document.getElementById("vortex-web-profile-style"))) return;
    mountBadges(profile, userId, record, isOwnProfile);
    mountOwnerControls(profile, userId, record, isOwnProfile);
  }

  function markCosmeticsReady() {
    document.documentElement.classList.remove("vw-profile-cosmetics-pending");
    document.documentElement.classList.add("vw-profile-cosmetics-ready");
  }

  function findProfileElements() {
    const header = document.querySelector(".profile-header");
    const username = header?.querySelector(".profile-username") ||
      document.querySelector("[data-profile-username], .profile-username, .profile-name");
    const bio = document.getElementById("bio-box") || document.querySelector(".bio-box");
    const page = document.getElementById("page") || document.querySelector(".page") || document.querySelector("main") || document.body;
    return {
      header: header instanceof HTMLElement ? header : null,
      username: username instanceof HTMLElement ? username : null,
      bio: bio instanceof HTMLElement ? bio : null,
      page: page instanceof HTMLElement ? page : document.body
    };
  }

  function detectOwnProfile(profile) {
    const page = profile.page || document.body;
    return !!page.querySelector(
      "[href*='/settings'], [href*='/account'], [data-profile-edit], #edit-profile, .edit-profile, #bio-edit, .bio-edit"
    ) || /\bEdit\b/.test(profile.bio?.textContent || "");
  }

  function decorateHeader(profile, record) {
    const { header, username } = profile;
    username.classList.add("vw-profile-name");
    username.classList.remove("vw-has-name-gradient");
    username.classList.remove(...EFFECT_CLASSES);
    username.querySelectorAll(".vw-profile-selected-badge").forEach((el) => el.remove());
    const nameText = ensureProfileNameText(username);
    nameText.classList.remove("vw-has-name-gradient");
    nameText.classList.remove(...EFFECT_CLASSES);
    resetNameGradient(nameText);

    if (record?.nameEffect) nameText.classList.add(`vw-name-effect-${record.nameEffect}`);
    applyNameGradient(nameText, record);

    const badge = api.selectedBadge(record);
    if (badge) {
      const badgeEl = document.createElement("span");
      badgeEl.className = badgeIconClass(record, badge, "vw-profile-selected-badge");
      badgeEl.title = badgeDescription(badge);
      badgeEl.innerHTML = badgeIcon(badge.kind);
      applyBadgeGradient(badgeEl, record);
      username.appendChild(badgeEl);
    }

    const nameplateUrl = record?.nameplateUrl || "";
    const currentMedia = header.querySelector(".vw-profile-nameplate-media");
    header.classList.toggle("vw-profile-header-nameplate", !!nameplateUrl);
    if (nameplateUrl) {
      setNameplateTone(header, "dark");
      header.dataset.vwNameplateUrl = nameplateUrl;
      if (isVideoUrl(nameplateUrl)) {
        header.classList.add("vw-has-video-nameplate");
        header.style.removeProperty("--vw-profile-nameplate-image");
        if (currentMedia?.dataset.vwNameplateUrl !== nameplateUrl) {
          currentMedia?.remove();
          const media = createMediaElement(nameplateUrl, "vw-profile-nameplate-media");
          media.dataset.vwNameplateUrl = nameplateUrl;
          header.prepend(media);
          applyNameplateTone(header, nameplateUrl, media);
        } else {
          applyNameplateTone(header, nameplateUrl, currentMedia);
        }
      } else {
        currentMedia?.remove();
        header.classList.remove("vw-has-video-nameplate");
        header.style.setProperty("--vw-profile-nameplate-image", `url("${cssUrl(nameplateUrl)}")`);
        applyNameplateTone(header, nameplateUrl);
      }
    } else {
      currentMedia?.remove();
      header.classList.remove("vw-has-video-nameplate");
      header.style.removeProperty("--vw-profile-nameplate-image");
      header.classList.remove("vw-nameplate-tone-dark", "vw-nameplate-tone-light");
      delete header.dataset.vwNameplateUrl;
    }

    mountProfileBackground(record);
  }

  function mountBadges(profile, userId, record, isOwnProfile) {
    const badges = api.allBadgeCatalog ? api.allBadgeCatalog(record) : (record?.badges || []);
    const existing = document.getElementById("vortex-web-profile-badges");
    if (!badges.length) {
      existing?.remove();
      return;
    }
    const badgesKey = JSON.stringify({
      userId,
      own: isOwnProfile,
      badges,
      badgeEffect: record?.badgeEffect || "",
      badgeGradient: record?.badgeGradient || [],
      selected: api.selectedBadge(record)?.id || ""
    });
    if (existing?.dataset.badgesKey === badgesKey) return;
    existing?.remove();

    const section = document.createElement("section");
    section.id = "vortex-web-profile-badges";
    section.className = "vw-profile-badge-section";
    section.dataset.badgesKey = badgesKey;
    section.innerHTML = `
      <div class="vw-profile-section-title">Badges</div>
      <div class="vw-profile-badges">${badges.map((badge) => renderBadge(badge, record, isOwnProfile)).join("")}</div>
    `;
    const anchor = profile.bio || profile.header;
    anchor.insertAdjacentElement("afterend", section);
  }

  function mountOwnerControls(profile, userId, record, isOwnProfile) {
    const existing = document.getElementById("vortex-web-profile-style");
    if (!isOwnProfile) {
      existing?.remove();
      return;
    }

    const badgesSection = document.getElementById("vortex-web-profile-badges");
    const anchor = badgesSection || profile.bio || profile.header;
    const editorKey = profileEditorKey(record);
    if (existing) {
      existing.dataset.userId = String(userId);
      wireProfilePanelToggle(existing);
      if (!isProfilePanelOpen(existing) && existing.dataset.editorKey !== editorKey) {
        existing.querySelector(".vw-profile-editor")?.replaceWith(buildEditor(userId, record));
        existing.dataset.editorKey = editorKey;
      }
      anchor.insertAdjacentElement("afterend", existing);
      return;
    }

    const panel = document.createElement("section");
    panel.id = "vortex-web-profile-style";
    panel.className = "vw-profile-style";
    panel.dataset.userId = String(userId);
    panel.dataset.editorKey = editorKey;
    panel.dataset.open = "0";
    panel.innerHTML = `
      <button type="button" class="vw-profile-style-toggle" aria-expanded="false" aria-controls="vortex-web-profile-style-body">
        <span>
          <b>Customize style</b>
          <small>Badges, name colour, and nameplate</small>
        </span>
      </button>
      <div id="vortex-web-profile-style-body" class="vw-profile-style-body" hidden></div>
    `;
    wireProfilePanelToggle(panel);
    panel.querySelector(".vw-profile-style-body")?.appendChild(buildEditor(userId, record));
    anchor.insertAdjacentElement("afterend", panel);
  }

  function wireProfilePanelToggle(panel) {
    const toggle = panel.querySelector(".vw-profile-style-toggle");
    if (!toggle || toggle.dataset.bound === "1") return;
    toggle.dataset.bound = "1";
    toggle.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      setProfilePanelOpen(panel, !isProfilePanelOpen(panel));
    });
  }

  function wireGlobalProfileActions() {
    if (document.documentElement.dataset.vwProfileActionsBound === "1") return;
    document.documentElement.dataset.vwProfileActionsBound = "1";
    document.addEventListener("pointerdown", handleProfileActionEvent, true);
    document.addEventListener("click", handleProfileActionEvent, true);
  }

  function handleProfileActionEvent(event) {
    const target = event.target;
    if (!target?.closest) return;

    const isPointer = event.type === "pointerdown";
    if (isPointer && "button" in event && event.button !== 0) return;

    const toggle = target.closest(".vw-profile-style-toggle");
    if (toggle) {
      const panel = toggle.closest("#vortex-web-profile-style");
      if (!panel) return;
      if (consumeDuplicateProfileClick(event, "toggle")) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      rememberProfilePointerAction(event, "toggle");
      setProfilePanelOpen(panel, !isProfilePanelOpen(panel));
      return;
    }

    const badgeButton = target.closest("[data-vw-select-badge]");
    if (badgeButton?.closest("#vortex-web-profile-badges")) {
      const key = `badge:${badgeButton.getAttribute("data-vw-select-badge") || "hide"}`;
      if (consumeDuplicateProfileClick(event, key)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      rememberProfilePointerAction(event, key);
      selectProfileBadge(badgeButton);
    }
  }

  function consumeDuplicateProfileClick(event, key) {
    if (event.type !== "click") return false;
    const recentPointer = lastProfilePointerAction.key === key && performance.now() - lastProfilePointerAction.at < 700;
    if (!recentPointer) return false;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    return true;
  }

  function rememberProfilePointerAction(event, key) {
    if (event.type !== "pointerdown") return;
    lastProfilePointerAction = { key, at: performance.now() };
  }

  async function selectProfileBadge(button, providedState = null) {
    const state = providedState || currentProfileRender;
    if (!state?.isOwnProfile || button.disabled) return;
    const badgeId = button.getAttribute("data-vw-select-badge") || "";
    const nextBadges = (state.record?.badges || []).map((badge) => ({
      ...badge,
      selected: badgeId ? badge.id === badgeId : false
    }));
    button.disabled = true;
    try {
      const result = await api.saveRecord(state.userId, { userId: state.userId, badges: nextBadges });
      if (!result?.lastSave?.ok) {
        showProfileNotice("Launch a game once to link this browser before saving profile cosmetics.", "error");
      } else {
        currentProfileRender = {
          ...state,
          record: {
            ...(state.record || {}),
            userId: state.userId,
            badges: nextBadges
          }
        };
      }
    } catch (error) {
      console.warn("[vortex-web-profile] badge selection failed", error);
      showProfileNotice("Could not save that badge selection. Try again after relaunching the game.", "error");
    } finally {
      button.disabled = false;
    }
    lastRenderKey = "";
    scheduleRender(true);
  }

  function isProfilePanelOpen(panel) {
    return panel?.dataset.open === "1";
  }

  function setProfilePanelOpen(panel, open) {
    panel.dataset.open = open ? "1" : "0";
    panel.querySelector(".vw-profile-style-toggle")?.setAttribute("aria-expanded", open ? "true" : "false");
    const body = panel.querySelector(".vw-profile-style-body");
    if (body) body.hidden = !open;
  }

  function profileEditorKey(record) {
    return JSON.stringify({
      badges: record?.badges || [],
      nameEffect: record?.nameEffect || "",
      nameGradient: record?.nameGradient || [],
      badgeEffect: record?.badgeEffect || "",
      badgeGradient: record?.badgeGradient || [],
      nameplateUrl: record?.nameplateUrl || "",
      profileBackgroundUrl: record?.profileBackgroundUrl || ""
    });
  }

  function buildEditor(userId, record) {
    const form = document.createElement("form");
    form.className = "vw-profile-editor";
    const effects = api.unlockedNameEffects(record);
    const gradients = api.unlockedNameGradients(record);
    const badgeEffects = api.unlockedBadgeEffects ? api.unlockedBadgeEffects(record) : effects;
    const selectedGradient = selectedGradientPreset(record, gradients);
    const selectedBadgeGradient = selectedGradientPreset({ nameGradient: record?.badgeGradient }, gradients);
    form.innerHTML = `
      <label>
        <span>Name effect</span>
        <select name="effect">
          ${effects.map((effect) => `<option value="${escapeAttr(effect.id)}"${(record?.nameEffect || "none") === effect.id ? " selected" : ""}>${escapeHtml(effect.label)}</option>`).join("")}
        </select>
      </label>
      <div class="vw-profile-field">
        <span>Name gradient</span>
        <div class="vw-gradient-options">
          ${gradients.map((gradient) => renderGradientChoice(gradient, selectedGradient)).join("")}
        </div>
      </div>
      <label>
        <span>Badge effect</span>
        <select name="badgeEffect">
          ${badgeEffects.map((effect) => `<option value="${escapeAttr(effect.id)}"${(record?.badgeEffect || "none") === effect.id ? " selected" : ""}>${escapeHtml(effect.label)}</option>`).join("")}
        </select>
      </label>
      <div class="vw-profile-field">
        <span>Badge gradient</span>
        <div class="vw-gradient-options">
          ${gradients.map((gradient) => renderGradientChoice(gradient, selectedBadgeGradient, "badgeGradientPreset")).join("")}
        </div>
      </div>
      <details class="vw-profile-advanced">
        <summary>Advanced</summary>
        <label>
          <span>Custom gradient</span>
          <input name="gradient" placeholder="#60a5fa, #a78bfa" value="${escapeAttr((record?.nameGradient || []).join(", "))}">
        </label>
        <label>
          <span>Nameplate image</span>
          <input name="nameplate" placeholder="https://..." value="${escapeAttr(record?.nameplateUrl || "")}">
        </label>
        <label>
          <span>Profile background</span>
          <input name="background" placeholder="https://..." value="${escapeAttr(record?.profileBackgroundUrl || "")}">
        </label>
        <label>
          <span>Badge gradient</span>
          <input name="badgeGradient" placeholder="#2563eb, #7c3aed" value="${escapeAttr((record?.badgeGradient || []).join(", "))}">
        </label>
      </details>
      <div class="vw-profile-editor-actions">
        <button type="submit">Save style</button>
        <button type="button" data-vw-clear-profile-auth hidden>Clear linked auth</button>
      </div>
      <div class="vw-profile-save-status" role="status" aria-live="polite"></div>
    `;
    const clearAuthButton = form.querySelector("[data-vw-clear-profile-auth]");
    api.hasProfileAuth?.(userId).then((hasAuth) => {
      if (clearAuthButton) clearAuthButton.hidden = !hasAuth;
    }).catch(() => { });
    clearAuthButton?.addEventListener("click", async () => {
      await api.unlinkProfileAuth?.(userId);
      clearAuthButton.hidden = true;
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const customGradient = String(data.get("gradient") || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const presetId = String(data.get("gradientPreset") || "none");
      const presetGradient = gradients.find((gradient) => gradient.id === presetId);
      const gradient = chooseGradient(presetId, presetGradient, customGradient);
      const customBadgeGradient = String(data.get("badgeGradient") || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const badgePresetId = String(data.get("badgeGradientPreset") || "none");
      const badgePresetGradient = gradients.find((gradient) => gradient.id === badgePresetId);
      const badgeGradient = chooseGradient(badgePresetId, badgePresetGradient, customBadgeGradient);
      const submit = form.querySelector("button[type='submit']");
      submit.disabled = true;
      const result = await api.saveRecord(userId, {
        userId,
        nameEffect: String(data.get("effect") || "none") === "none" ? "" : String(data.get("effect") || ""),
        nameGradient: gradient.length === 2 ? gradient : [],
        badgeEffect: String(data.get("badgeEffect") || "none") === "none" ? "" : String(data.get("badgeEffect") || ""),
        badgeGradient: badgeGradient.length === 2 ? badgeGradient : [],
        nameplateUrl: String(data.get("nameplate") || ""),
        profileBackgroundUrl: String(data.get("background") || "")
      });
      submit.disabled = false;
      if (!result?.lastSave?.ok) {
        setFormStatus(form, "Launch a game once to link this browser before saving profile cosmetics.", "error");
      } else {
        setFormStatus(form, "Saved.", "ok");
      }
      lastRenderKey = "";
      scheduleRender(true);
    });
    return form;
  }

  function setFormStatus(form, message, tone) {
    const status = form.querySelector(".vw-profile-save-status");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", tone === "error");
    status.classList.toggle("is-ok", tone === "ok");
  }

  function showProfileNotice(message, tone) {
    const panel = document.getElementById("vortex-web-profile-style");
    const status = panel?.querySelector(".vw-profile-save-status");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("is-error", tone === "error");
    status.classList.toggle("is-ok", tone === "ok");
  }

  function chooseGradient(presetId, presetGradient, customGradient) {
    if (presetId === "none") return customGradient.length === 2 ? customGradient : [];
    if (Array.isArray(presetGradient?.colors)) return presetGradient.colors;
  }

  function selectedGradientPreset(record, gradients) {
    const current = record?.nameGradient;
    if (!Array.isArray(current) || current.length !== 2) return "none";
    const match = gradients.find((gradient) => sameGradient(current, gradient.colors));
    return match?.id || "custom";
  }

  function sameGradient(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => String(value).toLowerCase() === String(right[index]).toLowerCase());
  }

  function renderGradientChoice(gradient, selectedId, name = "gradientPreset") {
    const colors = gradient.colors || ["#94a3b8", "#64748b"];
    const selected = selectedId === gradient.id ? " checked" : "";
    const style = `--vw-gradient-choice:linear-gradient(90deg, ${colors[0]}, ${colors[1]})`;
    return `<label class="vw-gradient-choice"${gradient.colors ? ` style="${escapeAttr(style)}"` : ""}>
      <input type="radio" name="${escapeAttr(name)}" value="${escapeAttr(gradient.id)}"${selected}>
      <span></span>
      <b>${escapeHtml(gradient.label)}</b>
    </label>`;
  }

  function applyNameGradient(element, record) {
    resetNameGradient(element);
    if (record?.nameGradient?.length !== 2) return;
    const [from, to] = record.nameGradient;
    element.classList.add("vw-has-name-gradient");
    element.style.setProperty("--vw-name-color-a", from);
    element.style.setProperty("--vw-name-color-b", to);
    element.style.setProperty("--vw-name-gradient", `linear-gradient(90deg, ${from}, ${to})`);
  }

  function resetNameGradient(element) {
    element.classList.remove("vw-has-name-gradient");
    element.style.removeProperty("--vw-name-color-a");
    element.style.removeProperty("--vw-name-color-b");
    element.style.removeProperty("--vw-name-gradient");
  }

  function ensureProfileNameText(username) {
    const existing = username.querySelector(":scope > .vw-profile-name-text");
    if (existing instanceof HTMLElement) return existing;
    const span = document.createElement("span");
    span.className = "vw-profile-name-text";
    while (username.firstChild) {
      span.appendChild(username.firstChild);
    }
    username.appendChild(span);
    return span;
  }

  function cleanHeadingText(heading) {
    if (!heading) return "";
    const text = heading.querySelector?.(".vw-profile-name-text");
    if (text) return (text.textContent || "").replace(/\s+/g, " ").trim();
    return Array.from(heading.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent || "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function mountProfileBackground(record) {
    const url = record?.profileBackgroundUrl || "";
    const existing = document.getElementById("vortex-web-profile-background");
    document.body.classList.toggle("vw-profile-has-bg", !!url);
    if (!url) {
      existing?.remove();
      return;
    }
    if (existing?.dataset.vwProfileBgUrl === url) return;
    existing?.remove();
    const layer = document.createElement("div");
    layer.id = "vortex-web-profile-background";
    layer.className = "vw-profile-bg-media";
    layer.dataset.vwProfileBgUrl = url;
    if (isVideoUrl(url)) {
      layer.appendChild(createMediaElement(url, "vw-profile-bg-video"));
    } else {
      layer.style.setProperty("--vw-profile-bg-image", `url("${cssUrl(url)}")`);
      layer.classList.add("vw-profile-bg-image");
    }
    document.body.prepend(layer);
  }

  function createMediaElement(url, className) {
    const video = document.createElement("video");
    video.className = className;
    video.src = url;
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    video.setAttribute("aria-hidden", "true");
    video.setAttribute("playsinline", "");
    video.addEventListener("loadeddata", () => {
      video.play().catch(() => { });
    }, { once: true });
    window.setTimeout(() => video.play().catch(() => { }), 0);
    return video;
  }

  function applyNameplateTone(header, url, media) {
    const cachedTone = mediaToneCache.get(url);
    if (typeof cachedTone === "string") {
      setNameplateTone(header, cachedTone);
      return;
    }
    if (cachedTone) {
      cachedTone.then((tone) => {
        if (!tone || header.dataset.vwNameplateUrl !== url) return;
        setNameplateTone(header, tone);
      }).catch(() => { });
      return;
    }
    const tonePromise = estimateMediaTone(url, media)
      .then((tone) => {
        const resolvedTone = tone || "dark";
        mediaToneCache.set(url, resolvedTone);
        if (header.dataset.vwNameplateUrl === url) setNameplateTone(header, resolvedTone);
        return resolvedTone;
      })
      .catch(() => {
        mediaToneCache.set(url, "dark");
        if (header.dataset.vwNameplateUrl === url) setNameplateTone(header, "dark");
        return "dark";
      });
    mediaToneCache.set(url, tonePromise);
  }

  function setNameplateTone(header, tone) {
    header.classList.toggle("vw-nameplate-tone-light", tone === "light");
    header.classList.toggle("vw-nameplate-tone-dark", tone !== "light");
  }

  async function estimateMediaTone(url, media) {
    if (!media && !isSameOriginUrl(url)) return "dark";
    const source = media || await loadToneImage(url);
    if (source instanceof HTMLVideoElement && source.readyState < 2) {
      await new Promise((resolve) => source.addEventListener("loadeddata", resolve, { once: true }));
    }
    const canvas = document.createElement("canvas");
    canvas.width = 24;
    canvas.height = 24;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let total = 0;
    let count = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = pixels[index + 3] / 255;
      if (alpha < 0.2) continue;
      total += (0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]) * alpha;
      count += alpha;
    }
    if (!count) return null;
    return total / count > 150 ? "light" : "dark";
  }

  function isSameOriginUrl(url) {
    try {
      return new URL(url, location.href).origin === location.origin;
    } catch {
      return false;
    }
  }

  function loadToneImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = url;
    });
  }

  function isVideoUrl(url) {
    return /\.(mp4|webm|mov)(\?|#|$)/i.test(String(url || ""));
  }

  function badgeIconClass(record, badge, extra = "") {
    return [
      extra,
      "vw-badge-icon",
      `vw-badge-icon-${badge.kind}`,
      record?.badgeGradient?.length === 2 ? "vw-has-badge-gradient" : "",
      record?.badgeEffect ? `vw-badge-effect-${record.badgeEffect}` : ""
    ].filter(Boolean).join(" ");
  }

  function applyBadgeGradient(element, record) {
    element.classList.remove(...BADGE_EFFECT_CLASSES);
    if (record?.badgeEffect) element.classList.add(`vw-badge-effect-${record.badgeEffect}`);
    if (record?.badgeGradient?.length === 2) {
      element.classList.add("vw-has-badge-gradient");
      element.style.setProperty("--vw-badge-gradient", `linear-gradient(135deg, ${record.badgeGradient[0]}, ${record.badgeGradient[1]})`);
    } else {
      element.classList.remove("vw-has-badge-gradient");
      element.style.removeProperty("--vw-badge-gradient");
    }
  }

  function renderBadge(badge, record, isOwnProfile) {
    const locked = badge.locked ? " locked" : "";
    const isSelected = !badge.locked && api.selectedBadge(record)?.id === badge.id;
    const selected = isSelected ? " selected" : "";
    const action = isOwnProfile && !badge.locked
      ? `<button type="button" data-vw-select-badge="${isSelected ? "" : escapeAttr(badge.id)}">${isSelected ? "Hide" : "Use"}</button>`
      : "";
    return `<span class="vw-badge-card${locked}${selected}" title="${escapeAttr(badgeDescription(badge))}">
      <span class="${escapeAttr(badgeIconClass(record, badge))}"${record?.badgeGradient?.length === 2 ? ` style="--vw-badge-gradient:linear-gradient(135deg, ${escapeAttr(record.badgeGradient[0])}, ${escapeAttr(record.badgeGradient[1])})"` : ""}>${badgeIcon(badge.kind)}</span>
      <span class="vw-badge-label"><b>${escapeHtml(badge.label)}</b></span>
      ${action}
    </span>`;
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
    if (kind === "developer") return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1.293 11.293l4-4a1 1 0 1 1 1.414 1.414L3.414 12l3.293 3.293a1 1 0 1 1-1.414 1.414l-4-4a1 1 0 0 1 0-1.414Zm17.414-4a1 1 0 1 0-1.414 1.414L20.586 12l-3.293 3.293a1 1 0 1 0 1.414 1.414l4-4a1 1 0 0 0 0-1.414ZM13.039 4.726l-4 14a1 1 0 0 0 .686 1.236A1.053 1.053 0 0 0 10 20a1 1 0 0 0 .961-.726l4-14a1 1 0 1 0-1.922-.548Z"/></svg>`;
    if (kind === "sponsor") return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11.269 4.411c.232-.519.347-.779.509-.859a.5.5 0 0 1 .444 0c.161.08.277.34.508.859l1.845 4.137c.068.154.102.23.155.289a.5.5 0 0 0 .168.122c.073.032.156.041.323.059l4.505.475c.565.06.848.09.974.218a.5.5 0 0 1 .137.423c-.026.178-.237.368-.66.749l-3.365 3.032c-.124.113-.187.169-.226.237a.5.5 0 0 0-.065.198c-.008.079.01.161.045.326l.939 4.43c.118.557.177.835.094.994a.5.5 0 0 1-.36.261c-.177.03-.423-.112-.916-.396L12.4 17.702c-.146-.084-.219-.125-.296-.142a.5.5 0 0 0-.208 0c-.077.017-.15.058-.296.142l-3.923 2.263c-.493.284-.739.426-.917.397a.5.5 0 0 1-.359-.262c-.083-.159-.024-.437.094-.994l.939-4.43c.035-.165.053-.247.044-.326a.5.5 0 0 0-.064-.198c-.04-.068-.102-.124-.227-.237l-3.365-3.032c-.422-.38-.633-.57-.659-.749a.5.5 0 0 1 .137-.423c.126-.128.409-.158.974-.218l4.504-.475c.168-.018.252-.027.324-.059a.5.5 0 0 0 .168-.122c.053-.059.087-.135.155-.289l1.844-4.137Z"/></svg>`;
    if (kind === "supporter") return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.243 8.243 8 15l6.757-6.757A4.243 4.243 0 0 0 16 5.243v-.191A4.052 4.052 0 0 0 11.948 1a4.052 4.052 0 0 0-3.165 1.521L8 3.5l-.783-.979A4.052 4.052 0 0 0 4.052 1 4.052 4.052 0 0 0 0 5.052v.191c0 1.125.447 2.204 1.243 3Z"/></svg>`;
    if (kind === "contributor") return `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 13.058.442A4.981 4.981 0 0 0 11 0a5 5 0 0 0-5 5c0 .458.062.902.177 1.323L0 12.5 3.5 16l6.177-6.177c.421.115.865.177 1.323.177a5 5 0 0 0 4.558-7.058L12.5 6H10V3.5Z"/></svg>`;
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M3 18c0-2.606 1.661-4.823 3.982-5.652A5.987 5.987 0 0 1 9 12c.708 0 1.388.123 2.018.348.343.122.671.275.982.455.311-.18.639-.333.982-.455A5.987 5.987 0 0 1 15 12c.708 0 1.388.123 2.018.348C19.339 13.177 21 15.394 21 18v3h-5.25v-1.5h3.75V18a4.5 4.5 0 0 0-6.188-4.173A5.983 5.983 0 0 1 15 18v3H3v-3Zm6-6.75a3.75 3.75 0 1 1 3-6 3.75 3.75 0 1 1 1.111 5.49A3.74 3.74 0 0 1 12 9.75a3.74 3.74 0 0 1-1.111.99A3.73 3.73 0 0 1 9 11.25ZM13.5 18v1.5h-9V18a4.5 4.5 0 0 1 9 0Zm-2.25-10.5a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0ZM15 5.25a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z"/></svg>`;
  }

  function cssUrl(value) {
    return String(value || "").replace(/["'\\\n\r]/g, "");
  }

  function escapeHtml(value) {
    return api.escapeHtml(value);
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
  }

  scheduleRender(true);
  wireGlobalProfileActions();
  startProfileDomObserver();
  window.addEventListener("vortex-web-cosmetics-updated", (event) => {
    const userId = profileUserId();
    if (!userId || Number(event.detail?.userId) !== userId) return;
    lastRenderKey = "";
    scheduleRender(true);
  });
  window.addEventListener("popstate", () => {
    lastRenderKey = "";
    scheduleRender(true);
  });
})(0);
