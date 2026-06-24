(function () {
  const STORAGE_KEY = "vortexWebCosmetics";
  const API_BASE = "https://v22.irongiant.vip";
  const DEFAULT_RECORDS = {};

  const BADGE_META = {
    developer: { label: "Developer", short: "DEV" },
    sponsor: { label: "Sponsor", short: "SP" },
    supporter: { label: "Supporter", short: "SUP" },
    contributor: { label: "Contributor", short: "CON" },
    community: { label: "Community", short: "COM" }
  };
  const NAME_EFFECTS = {
    none: { label: "None", requires: [] },
    aurora: { label: "Shimmer", requires: ["contributor", "supporter", "sponsor", "developer"] },
    prism: { label: "Chroma", requires: ["supporter", "sponsor", "developer"] },
    ember: { label: "Glow", requires: ["sponsor", "developer"] },
    phantasm: { label: "Phantasm", requires: ["supporter", "sponsor", "developer"] },
    toxic: { label: "Toxic", requires: ["contributor", "supporter", "sponsor", "developer"] },
    noxious: { label: "Noxious", requires: ["sponsor", "developer"] },
    glitch: { label: "Glitch", requires: ["developer"] },
    pulse: { label: "Pulse", requires: ["developer"] }
  };
  const NAME_GRADIENTS = {
    none: { label: "None", requires: [], colors: null },
    vortex: { label: "Vortex", requires: ["contributor", "supporter", "sponsor", "developer"], colors: ["#60a5fa", "#a78bfa"] },
    candy: { label: "Candy", requires: ["supporter", "sponsor", "developer"], colors: ["#f472b6", "#c084fc"] },
    circuit: { label: "Circuit", requires: ["contributor", "supporter", "sponsor", "developer"], colors: ["#22c55e", "#38bdf8"] },
    gold: { label: "Gold", requires: ["sponsor", "developer"], colors: ["#f59e0b", "#fde68a"] },
    toxic: { label: "Toxic", requires: ["contributor", "supporter", "sponsor", "developer"], colors: ["#84cc16", "#22c55e"] },
    phantasm: { label: "Phantasm", requires: ["supporter", "sponsor", "developer"], colors: ["#c084fc", "#67e8f9"] },
    admin: { label: "Admin", requires: ["developer"], colors: ["#ef4444", "#f97316"] }
  };
  const BADGE_EFFECTS = {
    none: { label: "None", requires: [] },
    shine: { label: "Shine", requires: ["contributor", "supporter", "sponsor", "developer"] },
    phantasm: { label: "Phantasm", requires: ["supporter", "sponsor", "developer"] },
    toxic: { label: "Toxic", requires: ["contributor", "supporter", "sponsor", "developer"] },
    pulse: { label: "Pulse", requires: ["sponsor", "developer"] }
  };

  function readStorage(keys) {
    return new Promise((resolve) => {
      try {
        const api = globalThis.chrome || globalThis.browser;
        if (!api?.storage?.local) {
          resolve({});
          return;
        }
        api.storage.local.get(keys, (value) => resolve(value || {}));
      } catch {
        resolve({});
      }
    });
  }

  function writeStorage(value) {
    return new Promise((resolve) => {
      try {
        const api = globalThis.chrome || globalThis.browser;
        if (!api?.storage?.local) {
          resolve(false);
          return;
        }
        api.storage.local.set(value, () => resolve(true));
      } catch {
        resolve(false);
      }
    });
  }

  async function loadCosmeticsState() {
    const stored = await readStorage([STORAGE_KEY]);
    const saved = stored[STORAGE_KEY] || {};
    const records = { ...DEFAULT_RECORDS };
    for (const [userId, record] of Object.entries(saved.records || {})) {
      records[userId] = mergeRecord(records[userId], record, { replaceBadges: true });
    }
    return {
      ownUserId: await fetchOwnUserId(),
      records: normalizeRecords(records)
    };
  }

  async function loadCosmeticsUser(userId) {
    const id = Number(userId);
    if (!Number.isFinite(id) || id <= 0) return null;
    const serverRecord = await fetchCosmeticsRecord(id).catch(() => null);
    if (serverRecord) return serverRecord;
    const state = await loadCosmeticsState();
    return state.records[id] || null;
  }

  async function loadCosmeticsUsers(userIds) {
    const ids = [...new Set((Array.isArray(userIds) ? userIds : [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0))].slice(0, 100);
    if (!ids.length) return {};
    const serverRecords = await fetchCosmeticsRecords(ids).catch(() => ({}));
    const missing = ids.filter((id) => !serverRecords[id]);
    if (!missing.length) return normalizeRecords(serverRecords);
    const state = await loadCosmeticsState();
    const merged = { ...serverRecords };
    for (const id of missing) {
      if (state.records[id]) merged[id] = state.records[id];
    }
    return normalizeRecords(merged);
  }

  async function saveCosmeticsRecord(userId, patch) {
    const state = await loadCosmeticsState();
    const current = state.records[userId] || { userId, badges: [] };
    const next = normalizeRecord(mergeRecord(current, patch, { replaceBadges: hasOwn(patch, "badges") }));
    const serverSaved = await saveCosmeticsRecordRemote(userId, next).catch(() => null);
    const stored = await readStorage([STORAGE_KEY]);
    const saved = stored[STORAGE_KEY] || {};
    const records = { ...(saved.records || {}), [userId]: serverSaved || next };
    await writeStorage({ [STORAGE_KEY]: { ...saved, records } });
    return loadCosmeticsState();
  }

  async function fetchCosmeticsRecord(userId) {
    const res = await fetch(`${API_BASE}/community/profile/${encodeURIComponent(userId)}`, {
      credentials: "omit",
      cache: "no-store",
      headers: { accept: "application/json" }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return normalizeRecord(data.profile);
  }

  async function fetchCosmeticsRecords(userIds) {
    const res = await fetch(`${API_BASE}/community/profiles?ids=${encodeURIComponent(userIds.join(","))}`, {
      credentials: "omit",
      cache: "no-store",
      headers: { accept: "application/json" }
    });
    if (!res.ok) return {};
    const data = await res.json();
    return normalizeRecords(data.records || {});
  }

  async function saveCosmeticsRecordRemote(userId, record) {
    if (!record) return null;
    const res = await fetch(`${API_BASE}/community/profile/${encodeURIComponent(userId)}`, {
      method: "POST",
      credentials: "omit",
      cache: "no-store",
      headers: {
        accept: "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify(remoteRecordPayload(record))
    });
    if (!res.ok) return null;
    const data = await res.json();
    return normalizeRecord(data.profile);
  }

  function remoteRecordPayload(record) {
    const selectedBadge = (Array.isArray(record.badges) ? record.badges : []).find((badge) => badge?.selected);
    return {
      userId: record.userId,
      badges: Array.isArray(record.badges) ? record.badges : [],
      selectedBadgeId: selectedBadge ? String(selectedBadge.id || selectedBadge.kind || "") : "",
      nameEffect: record.nameEffect || "",
      nameGradient: Array.isArray(record.nameGradient) ? record.nameGradient : [],
      badgeEffect: record.badgeEffect || "",
      badgeGradient: Array.isArray(record.badgeGradient) ? record.badgeGradient : [],
      nameplateUrl: record.nameplateUrl || "",
      profileBackgroundUrl: record.profileBackgroundUrl || ""
    };
  }

  function mergeRecord(base, patch, options = {}) {
    const record = { ...(base || {}), ...(patch || {}) };
    const baseBadges = Array.isArray(base?.badges) ? base.badges : [];
    const patchBadges = Array.isArray(patch?.badges) ? patch.badges : [];
    if (options.replaceBadges && hasOwn(patch, "badges")) {
      record.badges = patchBadges;
      return record;
    }
    const byId = new Map();
    for (const badge of baseBadges) byId.set(String(badge.id || badge.kind), badge);
    for (const badge of patchBadges) byId.set(String(badge.id || badge.kind), { ...(byId.get(String(badge.id || badge.kind)) || {}), ...badge });
    record.badges = [...byId.values()];
    return record;
  }

  function normalizeRecords(records) {
    const out = {};
    for (const [userId, record] of Object.entries(records || {})) {
      const normalized = normalizeRecord({ ...record, userId: Number(userId) || Number(record.userId) });
      if (normalized) out[normalized.userId] = normalized;
    }
    return out;
  }

  function normalizeRecord(record) {
    const userId = Number(record?.userId ?? record?.user_id);
    if (!Number.isFinite(userId) || userId <= 0) return null;
    const badges = normalizeBadges(record.badges);
    const hasNameGradient = hasOwn(record, "nameGradient") || hasOwn(record, "name_gradient");
    const hasNameEffect = hasOwn(record, "nameEffect") || hasOwn(record, "name_effect");
    const hasBadgeGradient = hasOwn(record, "badgeGradient") || hasOwn(record, "badge_gradient");
    const hasBadgeEffect = hasOwn(record, "badgeEffect") || hasOwn(record, "badge_effect");
    const nameGradient = normalizeGradient(record.nameGradient ?? record.name_gradient);
    const nameEffect = normalizeNameEffect(record.nameEffect ?? record.name_effect, badges);
    const badgeGradient = normalizeGradient(record.badgeGradient ?? record.badge_gradient);
    const badgeEffect = normalizeBadgeEffect(record.badgeEffect ?? record.badge_effect, badges);
    return {
      userId,
      ...(hasNameGradient || nameGradient ? { nameGradient: nameGradient || [] } : {}),
      ...(hasNameEffect || nameEffect ? { nameEffect: nameEffect || "" } : {}),
      ...(hasBadgeGradient || badgeGradient ? { badgeGradient: badgeGradient || [] } : {}),
      ...(hasBadgeEffect || badgeEffect ? { badgeEffect: badgeEffect || "" } : {}),
      ...(safeHttpsUrl(record.nameplateUrl ?? record.nameplate_url) ? { nameplateUrl: safeHttpsUrl(record.nameplateUrl ?? record.nameplate_url) } : {}),
      ...(safeHttpsUrl(record.profileBackgroundUrl ?? record.profile_background_url) ? { profileBackgroundUrl: safeHttpsUrl(record.profileBackgroundUrl ?? record.profile_background_url) } : {}),
      badges
    };
  }

  function hasOwn(record, key) {
    return !!record && Object.prototype.hasOwnProperty.call(record, key);
  }

  function normalizeBadges(badges) {
    const seen = new Set();
    let selectedSeen = false;
    return (Array.isArray(badges) ? badges : [])
      .map((badge) => {
        const kind = String(badge.kind || badge.id || "").toLowerCase();
        if (!BADGE_META[kind] || seen.has(kind)) return null;
        seen.add(kind);
        const selected = !!badge.selected && !selectedSeen;
        if (selected) selectedSeen = true;
        return {
          id: String(badge.id || kind).slice(0, 48),
          kind,
          label: String(badge.label || BADGE_META[kind].label).trim().slice(0, 32),
          ...(selected ? { selected: true } : {})
        };
      })
      .filter(Boolean);
  }

  function normalizeGradient(value) {
    if (!Array.isArray(value) || value.length !== 2) return null;
    const colors = value.map((color) => String(color || "").trim());
    return colors.every(isSafeCssColor) ? colors : null;
  }

  function isSafeCssColor(value) {
    return /^(#[0-9a-f]{3,8}|rgb\([\d\s.,%]+\)|rgba\([\d\s.,%]+\)|hsl\([\d\s.,%]+\)|hsla\([\d\s.,%]+\)|[a-z]+)$/i.test(value);
  }

  function safeHttpsUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw);
      return url.protocol === "https:" ? url.toString() : "";
    } catch {
      return "";
    }
  }

  async function fetchOwnUserId() {
    for (const path of ["/me", "/api/me"]) {
      try {
        const res = await fetch(path, { credentials: "include", cache: "no-store", headers: { accept: "application/json" } });
        if (!res.ok) continue;
        const data = await res.json();
        const id = Number(data.id ?? data.user_id ?? data.userId);
        if (Number.isFinite(id)) return id;
      } catch {}
    }
    return null;
  }

  function selectedBadge(record) {
    return record?.badges?.find((badge) => badge.selected) || record?.badges?.[0] || null;
  }

  function hasCosmeticData(record) {
    return !!(
      record &&
      (
        record.nameEffect ||
        record.nameGradient?.length === 2 ||
        record.badgeGradient?.length === 2 ||
        record.badgeEffect ||
        record.nameplateUrl ||
        record.profileBackgroundUrl ||
        record.badges?.length
      )
    );
  }

  function unlockedNameEffects(record) {
    const kinds = new Set((record?.badges || []).map((badge) => badge.kind));
    return Object.entries(NAME_EFFECTS)
      .filter(([, effect]) => !effect.requires.length || effect.requires.some((kind) => kinds.has(kind)))
      .map(([id, effect]) => ({ id, label: effect.label }));
  }

  function unlockedNameGradients(record) {
    const kinds = new Set((record?.badges || []).map((badge) => badge.kind));
    return Object.entries(NAME_GRADIENTS)
      .filter(([, gradient]) => !gradient.requires.length || gradient.requires.some((kind) => kinds.has(kind)))
      .map(([id, gradient]) => ({ id, label: gradient.label, colors: gradient.colors }));
  }

  function unlockedBadgeEffects(record) {
    const kinds = new Set((record?.badges || []).map((badge) => badge.kind));
    return Object.entries(BADGE_EFFECTS)
      .filter(([, effect]) => !effect.requires.length || effect.requires.some((kind) => kinds.has(kind)))
      .map(([id, effect]) => ({ id, label: effect.label }));
  }

  function allBadgeCatalog(record) {
    const unlocked = new Map((record?.badges || []).map((badge) => [badge.kind, badge]));
    return Object.entries(BADGE_META).map(([kind, meta]) => {
      const badge = unlocked.get(kind);
      return badge
        ? { ...badge, locked: false }
        : { id: kind, kind, label: meta.label, locked: true };
    });
  }

  function normalizeNameEffect(effectId, badges) {
    const id = String(effectId || "none").toLowerCase();
    if (id === "none" || !NAME_EFFECTS[id]) return null;
    const kinds = new Set((badges || []).map((badge) => badge.kind));
    return NAME_EFFECTS[id].requires.some((kind) => kinds.has(kind)) ? id : null;
  }

  function normalizeBadgeEffect(effectId, badges) {
    const id = String(effectId || "none").toLowerCase();
    if (id === "none" || !BADGE_EFFECTS[id]) return null;
    const kinds = new Set((badges || []).map((badge) => badge.kind));
    return BADGE_EFFECTS[id].requires.some((kind) => kinds.has(kind)) ? id : null;
  }

  function badgeShort(badge) {
    return BADGE_META[badge?.kind]?.short || String(badge?.label || "?").slice(0, 3).toUpperCase();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function cosmeticsApi() {
    return {
      STORAGE_KEY,
      API_BASE,
      BADGE_META,
      NAME_EFFECTS,
      NAME_GRADIENTS,
      BADGE_EFFECTS,
      load: loadCosmeticsState,
      loadUser: loadCosmeticsUser,
      loadUsers: loadCosmeticsUsers,
      saveRecord: saveCosmeticsRecord,
      normalizeRecord,
      selectedBadge,
      unlockedNameEffects,
      unlockedNameGradients,
      unlockedBadgeEffects,
      allBadgeCatalog,
      badgeShort,
      escapeHtml
    };
  }

  globalThis.VortexWebCosmetics = cosmeticsApi();
})();
