(function () {
  const api = globalThis.VortexWebCosmetics;
  if (!api) return;

  const PROFILE_RE = /\/users\/(\d+)\/profile\/?$/;
  const EFFECT_CLASSES = [
    "vw-name-effect-aurora",
    "vw-name-effect-prism",
    "vw-name-effect-ember",
    "vw-name-effect-phantasm",
    "vw-name-effect-toxic",
    "vw-name-effect-noxious",
    "vw-name-effect-glitch",
    "vw-name-effect-pulse"
  ];
  const BADGE_EFFECT_CLASSES = [
    "vw-badge-effect-shine",
    "vw-badge-effect-phantasm",
    "vw-badge-effect-toxic",
    "vw-badge-effect-pulse"
  ];

  let renderTimer = 0;
  let lastRenderKey = "";

  function profileUserId() {
    const match = location.pathname.match(PROFILE_RE);
    return match ? Number(match[1]) : null;
  }

  function scheduleRender(force = false) {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => {
      renderProfile(force).catch(() => {});
    }, 80);
  }

  async function renderProfile(force = false) {
    const userId = profileUserId();
    if (!userId || !document.body) return;

    const profile = findProfileElements();
    if (!profile.header || !profile.username) {
      lastRenderKey = "";
      return;
    }

    const state = await api.load();
    const serverRecord = api.loadUser ? await api.loadUser(userId).catch(() => null) : null;
    const isOwnProfile = state.ownUserId === userId;
    const localRecord = state.records[userId] || null;
    const record = serverRecord || localRecord || null;
    const renderKey = JSON.stringify({
      userId,
      own: isOwnProfile,
      record,
      username: cleanHeadingText(profile.username)
    });
    if (!force && renderKey === lastRenderKey) return;
    lastRenderKey = renderKey;

    decorateHeader(profile, record);
    mountBadges(profile, userId, record, isOwnProfile);
    mountOwnerControls(profile, userId, record, isOwnProfile);
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

    header.querySelectorAll(".vw-profile-nameplate-media").forEach((el) => el.remove());
    header.classList.toggle("vw-profile-header-nameplate", !!record?.nameplateUrl);
    if (record?.nameplateUrl) {
      if (isVideoUrl(record.nameplateUrl)) {
        header.classList.add("vw-has-video-nameplate");
        header.style.removeProperty("--vw-profile-nameplate-image");
        header.prepend(createMediaElement(record.nameplateUrl, "vw-profile-nameplate-media"));
      } else {
        header.classList.remove("vw-has-video-nameplate");
        header.style.setProperty("--vw-profile-nameplate-image", `url("${cssUrl(record.nameplateUrl)}")`);
      }
    } else {
      header.classList.remove("vw-has-video-nameplate");
      header.style.removeProperty("--vw-profile-nameplate-image");
    }

    mountProfileBackground(record);
  }

  function mountBadges(profile, userId, record, isOwnProfile) {
    document.getElementById("vortex-web-profile-badges")?.remove();
    const badges = api.allBadgeCatalog ? api.allBadgeCatalog(record) : (record?.badges || []);
    if (!badges.length) return;

    const section = document.createElement("section");
    section.id = "vortex-web-profile-badges";
    section.className = "vw-profile-badge-section";
    section.innerHTML = `
      <div class="vw-profile-section-title">Badges</div>
      <div class="vw-profile-badges">${badges.map((badge) => renderBadge(badge, record, isOwnProfile)).join("")}</div>
    `;
    if (isOwnProfile) {
      section.addEventListener("pointerdown", (event) => {
        const button = event.target?.closest?.("[data-vw-select-badge]");
        if (!button) return;
        event.stopPropagation();
        event.stopImmediatePropagation?.();
      }, true);
      section.addEventListener("click", async (event) => {
        const button = event.target?.closest?.("[data-vw-select-badge]");
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        const badgeId = button.getAttribute("data-vw-select-badge") || "";
        const nextBadges = (record?.badges || []).map((badge) => ({ ...badge, selected: badge.id === badgeId }));
        await api.saveRecord(userId, { userId, badges: nextBadges });
        lastRenderKey = "";
        scheduleRender(true);
      }, true);
    }
    const anchor = profile.bio || profile.header;
    anchor.insertAdjacentElement("afterend", section);
  }

  function mountOwnerControls(profile, userId, record, isOwnProfile) {
    document.getElementById("vortex-web-profile-style")?.remove();
    if (!isOwnProfile) return;

    const panel = document.createElement("details");
    panel.id = "vortex-web-profile-style";
    panel.className = "vw-profile-style";
    panel.innerHTML = `
      <summary>
        <span>
          <b>Customize style</b>
          <small>Badges, name colour, and nameplate</small>
        </span>
      </summary>
    `;
    panel.appendChild(buildEditor(userId, record));

    const badgesSection = document.getElementById("vortex-web-profile-badges");
    const anchor = badgesSection || profile.bio || profile.header;
    anchor.insertAdjacentElement("afterend", panel);
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
      <button type="submit">Save style</button>
    `;
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
      await api.saveRecord(userId, {
        userId,
        nameEffect: String(data.get("effect") || "none") === "none" ? "" : String(data.get("effect") || ""),
        nameGradient: gradient.length === 2 ? gradient : [],
        badgeEffect: String(data.get("badgeEffect") || "none") === "none" ? "" : String(data.get("badgeEffect") || ""),
        badgeGradient: badgeGradient.length === 2 ? badgeGradient : [],
        nameplateUrl: String(data.get("nameplate") || ""),
        profileBackgroundUrl: String(data.get("background") || "")
      });
      lastRenderKey = "";
      scheduleRender(true);
    });
    return form;
  }

  function chooseGradient(presetId, presetGradient, customGradient) {
    if (presetId === "none") return [];
    if (Array.isArray(presetGradient?.colors)) return presetGradient.colors;
    return customGradient.length === 2 ? customGradient : [];
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
    element.classList.add("vw-has-name-gradient");
    element.style.setProperty("--vw-name-gradient", `linear-gradient(90deg, ${record.nameGradient[0]}, ${record.nameGradient[1]})`);
  }

  function resetNameGradient(element) {
    element.classList.remove("vw-has-name-gradient");
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
    document.getElementById("vortex-web-profile-background")?.remove();
    document.body.classList.toggle("vw-profile-has-bg", !!record?.profileBackgroundUrl);
    if (!record?.profileBackgroundUrl) return;
    const layer = document.createElement("div");
    layer.id = "vortex-web-profile-background";
    layer.className = "vw-profile-bg-media";
    if (isVideoUrl(record.profileBackgroundUrl)) {
      layer.appendChild(createMediaElement(record.profileBackgroundUrl, "vw-profile-bg-video"));
    } else {
      layer.style.setProperty("--vw-profile-bg-image", `url("${cssUrl(record.profileBackgroundUrl)}")`);
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
      video.play().catch(() => {});
    }, { once: true });
    window.setTimeout(() => video.play().catch(() => {}), 0);
    return video;
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
    const selected = !badge.locked && api.selectedBadge(record)?.id === badge.id ? " selected" : "";
    const action = isOwnProfile && !badge.locked && !selected
      ? `<button type="button" data-vw-select-badge="${escapeAttr(badge.id)}">Use</button>`
      : "";
    return `<span class="vw-badge-card${locked}${selected}" title="${escapeAttr(badgeDescription(badge))}">
      <span class="${escapeAttr(badgeIconClass(record, badge))}"${record?.badgeGradient?.length === 2 ? ` style="--vw-badge-gradient:linear-gradient(135deg, ${escapeAttr(record.badgeGradient[0])}, ${escapeAttr(record.badgeGradient[1])})"` : ""}>${badgeIcon(badge.kind)}</span>
      <span><b>${escapeHtml(badge.label)}</b><small>${badge.locked ? "Locked" : escapeHtml(badgeDescription(badge))}</small></span>
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
    if (kind === "developer") return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.7 16.9 3.8 12l4.9-4.9 1.4 1.4L6.6 12l3.5 3.5-1.4 1.4Zm6.6 0-1.4-1.4 3.5-3.5-3.5-3.5 1.4-1.4 4.9 4.9-4.9 4.9Zm-4.1 2.2-1.9-.6 3.5-13.6 1.9.6-3.5 13.6Z"/></svg>';
    if (kind === "sponsor") return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 2.9 6 6.6.9-4.8 4.7 1.1 6.6L12 17.1l-5.8 3.1 1.1-6.6-4.8-4.7 6.6-.9L12 2Z"/></svg>';
    if (kind === "supporter") return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.5-9.1C1.1 8.8 3 5.5 6.4 5.5c2 0 3.3 1.1 4.1 2.2.8-1.1 2.1-2.2 4.1-2.2 3.4 0 5.3 3.3 3.9 6.4C16.5 16.4 12 21 12 21Z"/></svg>';
    if (kind === "contributor") return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v3h3v10h-3v3H7v-3H4V7h3V4Zm2 2v3H6v6h3v3h6v-3h3V9h-3V6H9Zm2 4h2v2h2v2h-2v2h-2v-2H9v-2h2v-2Z"/></svg>';
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 20 8v8l-8 4.5L4 16V8l8-4.5Zm0 2.3L6 9.2v5.6l6 3.4 6-3.4V9.2l-6-3.4Zm0 3.2 3 1.7v3.6L12 16l-3-1.7v-3.6L12 9Z"/></svg>';
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
  window.addEventListener("popstate", () => {
    lastRenderKey = "";
    scheduleRender(true);
  });
  const observer = new MutationObserver(() => scheduleRender(false));
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
