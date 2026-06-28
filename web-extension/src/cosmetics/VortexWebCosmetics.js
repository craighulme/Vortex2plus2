(function () {
  document.documentElement.dataset.vwCosmeticsApiScript = "20260624-cache-negative";

  const STORAGE_KEY = "vortexWebCosmetics";
  const PROFILE_AUTH_KEY = "vortexWebProfileAuth";
  const LAST_LICENSE_LEASE_KEY = "vwebLastLicenseLease";
  const API_BASE = "https://v22.irongiant.vip";
  const DEFAULT_RECORDS = {};
  const CACHE_VERSION = 3;
  const PROFILE_CACHE_TTL_MS = 10 * 60 * 1000;
  const OWN_USER_CACHE_TTL_MS = 2 * 60 * 1000;
  const BRIDGE_RESPONSE_TTL_MS = 30 * 1000;
  const REFRESH_RETRY_MS = 30 * 1000;
  const inflightUserRefreshes = new Map();
  const inflightUsersRefreshes = new Map();
  const inflightBridgeRequests = new Map();
  const bridgeResponseCache = new Map();
  const lastRefreshAttemptAt = new Map();
  let inflightOwnUserId = null;

  const BADGE_META = {
    developer: { label: "Developer", short: "DEV" },
    sponsor: { label: "Sponsor", short: "SP" },
    supporter: { label: "Supporter", short: "SUP" },
    contributor: { label: "Contributor", short: "CON" },
    community: { label: "Community", short: "COM" }
  };
  const NAME_EFFECTS = {
    none: { label: "None", requires: [] },
    flow: { label: "Flow", requires: ["contributor", "supporter", "sponsor", "developer"] },
    holo: { label: "Holographic", requires: ["supporter", "sponsor", "developer"] },
    neon: { label: "Neon", requires: ["sponsor", "developer"] },
    toxic: { label: "Toxic", requires: ["contributor", "supporter", "sponsor", "developer"] },
    glitch: { label: "Glitch", requires: ["developer"] }
  };
  const LEGACY_NAME_EFFECTS = {
    aurora: "flow",
    pulse: "flow",
    prism: "holo",
    phantasm: "holo",
    frost: "holo",
    void: "holo",
    ember: "neon",
    solar: "neon",
    noxious: "toxic",
    static: "glitch"
  };
  const NAME_GRADIENTS = {
    none: { label: "None", requires: [], colors: null },
    vortex: { label: "Vortex", requires: ["contributor", "supporter", "sponsor", "developer"], colors: ["#60a5fa", "#a78bfa"] },
    candy: { label: "Candy", requires: ["supporter", "sponsor", "developer"], colors: ["#f472b6", "#c084fc"] },
    circuit: { label: "Circuit", requires: ["contributor", "supporter", "sponsor", "developer"], colors: ["#22c55e", "#38bdf8"] },
    gold: { label: "Gold", requires: ["sponsor", "developer"], colors: ["#f59e0b", "#fde68a"] },
    toxic: { label: "Toxic", requires: ["contributor", "supporter", "sponsor", "developer"], colors: ["#84cc16", "#22c55e"] },
    phantasm: { label: "Phantasm", requires: ["supporter", "sponsor", "developer"], colors: ["#c084fc", "#67e8f9"] },
    admin: { label: "Admin", requires: ["developer"], colors: ["#ef4444", "#f97316"] },
    neon: { label: "Neon", requires: ["supporter", "sponsor", "developer"], colors: ["#22d3ee", "#fb7185"] },
    sunset: { label: "Sunset", requires: ["supporter", "sponsor", "developer"], colors: ["#f97316", "#ec4899"] },
    frost: { label: "Frost", requires: ["contributor", "supporter", "sponsor", "developer"], colors: ["#7dd3fc", "#e0f2fe"] },
    void: { label: "Void", requires: ["sponsor", "developer"], colors: ["#8b5cf6", "#020617"] },
    lava: { label: "Lava", requires: ["sponsor", "developer"], colors: ["#ef4444", "#facc15"] },
    ocean: { label: "Ocean", requires: ["contributor", "supporter", "sponsor", "developer"], colors: ["#06b6d4", "#2563eb"] }
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

  async function loadCachedCosmeticsState() {
    const saved = await readCosmeticsCache();
    return {
      ownUserId: saved.ownUserId,
      ownUserFetchedAt: saved.ownUserFetchedAt,
      records: saved.records,
      fetchedAt: saved.fetchedAt,
      cacheTtlMs: PROFILE_CACHE_TTL_MS
    };
  }

  async function loadCosmeticsState() {
    const saved = await readCosmeticsCache();
    let ownUserId = saved.ownUserId;
    let ownUserFetchedAt = saved.ownUserFetchedAt;
    if (!ownUserId || Date.now() - ownUserFetchedAt > OWN_USER_CACHE_TTL_MS) {
      const fetchedOwnUserId = await fetchOwnUserIdOnce();
      if (fetchedOwnUserId) {
        ownUserId = fetchedOwnUserId;
        ownUserFetchedAt = Date.now();
        await writeCosmeticsCache({ ...saved, ownUserId, ownUserFetchedAt });
      }
    }
    return {
      ownUserId,
      ownUserFetchedAt,
      records: saved.records,
      fetchedAt: saved.fetchedAt,
      cacheTtlMs: PROFILE_CACHE_TTL_MS
    };
  }

  async function loadCosmeticsUser(userId) {
    const id = Number(userId);
    if (!Number.isFinite(id) || id <= 0) return null;
    const state = await readCosmeticsCache();
    const cached = state.records[id] || null;
    if (cached) {
      if (!isFresh(state.fetchedAt[id], PROFILE_CACHE_TTL_MS)) {
        refreshCosmeticsUser(id).catch(() => {});
      }
      return cached;
    }
    if (isFresh(state.fetchedAt[id], PROFILE_CACHE_TTL_MS)) return null;
    return refreshCosmeticsUser(id);
  }

  async function loadCosmeticsUsers(userIds) {
    const ids = [...new Set((Array.isArray(userIds) ? userIds : [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0))].slice(0, 100);
    if (!ids.length) return {};
    const state = await readCosmeticsCache();
    const out = {};
    const missing = [];
    const stale = [];
    for (const id of ids) {
      if (state.records[id]) out[id] = state.records[id];
      if (!state.records[id] && !isFresh(state.fetchedAt[id], PROFILE_CACHE_TTL_MS)) missing.push(id);
      else if (!isFresh(state.fetchedAt[id], PROFILE_CACHE_TTL_MS)) stale.push(id);
    }
    if (missing.length) {
      return normalizeRecords({ ...out, ...await refreshCosmeticsUsers(missing) });
    }
    if (stale.length) {
      refreshCosmeticsUsers(stale).catch(() => {});
    }
    return normalizeRecords(out);
  }

  async function saveCosmeticsRecord(userId, patch) {
    const id = Number(userId);
    if (!Number.isFinite(id) || id <= 0) {
      return { ...(await loadCosmeticsState()), lastSave: { ok: false, error: "invalid_user_id" } };
    }
    const state = await loadCosmeticsState();
    let current = state.records[id] || null;
    if ((!current?.badges?.length) && !hasOwn(patch, "badges")) {
      current = await fetchCosmeticsRecord(id).catch(() => null);
    }
    current = current || { userId: id, badges: [] };
    const next = normalizeRecord(mergeRecord(current, { ...patch, userId: id }, { replaceBadges: hasOwn(patch, "badges") }));
    const serverSaved = await saveCosmeticsRecordRemote(id, next).catch(() => null);
    if (!serverSaved || !serverMatchesRequest(serverSaved, next)) {
      await removeCosmeticsRecord(id);
      const liveRecord = await fetchCosmeticsRecord(id).catch(() => null);
      if (liveRecord) {
        await cacheCosmeticsRecords({ [id]: liveRecord }, Date.now());
        dispatchCosmeticsUpdate(id, liveRecord);
      } else {
        dispatchCosmeticsUpdate(id, null);
      }
      return { ...(await loadCosmeticsState()), lastSave: { ok: false, error: "remote_denied" } };
    }
    const reconciled = normalizeRecord(serverSaved) || serverSaved;
    await cacheCosmeticsRecords({ [id]: reconciled }, Date.now());
    dispatchCosmeticsUpdate(id, reconciled);
    return { ...(await loadCosmeticsState()), lastSave: { ok: true } };
  }

  function serverMatchesRequest(serverRecord, requestedRecord) {
    if (!serverRecord || !requestedRecord) return false;
    const checks = [
      ["nameEffect", ""],
      ["badgeEffect", ""],
      ["nameplateUrl", ""],
      ["profileBackgroundUrl", ""]
    ];
    for (const [key, empty] of checks) {
      if (hasOwn(requestedRecord, key) && String(serverRecord[key] || empty) !== String(requestedRecord[key] || empty)) {
        return false;
      }
    }
    for (const key of ["nameGradient", "badgeGradient"]) {
      if (hasOwn(requestedRecord, key) && JSON.stringify(serverRecord[key] || []) !== JSON.stringify(requestedRecord[key] || [])) {
        return false;
      }
    }
    return true;
  }

  async function refreshCosmeticsUser(userId) {
    const id = Number(userId);
    if (!Number.isFinite(id) || id <= 0) return null;
    if (inflightUserRefreshes.has(id)) return inflightUserRefreshes.get(id);
    const cachedState = await readCosmeticsCache();
    const cached = cachedState.records[id] || null;
    const lastAttempt = Number(lastRefreshAttemptAt.get(id) || 0);
    if (cached && Date.now() - lastAttempt < REFRESH_RETRY_MS) return cached;
    if (!cached && isFresh(cachedState.fetchedAt[id], PROFILE_CACHE_TTL_MS)) return null;
    lastRefreshAttemptAt.set(id, Date.now());
    const refresh = (async () => {
      const serverRecord = await fetchCosmeticsRecord(id).catch(() => null);
      if (serverRecord) {
        const state = await readCosmeticsCache();
        const previous = state.records[id] || null;
        await cacheCosmeticsRecords({ [id]: serverRecord }, Date.now());
        if (JSON.stringify(previous) !== JSON.stringify(serverRecord)) {
          dispatchCosmeticsUpdate(id, serverRecord);
        }
        return serverRecord;
      }
      await markCosmeticsChecked([id], Date.now());
      const state = await readCosmeticsCache();
      return state.records[id] || null;
    })().finally(() => inflightUserRefreshes.delete(id));
    inflightUserRefreshes.set(id, refresh);
    return refresh;
  }

  async function refreshCosmeticsUsers(userIds) {
    const ids = [...new Set((Array.isArray(userIds) ? userIds : [])
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0))].slice(0, 100);
    if (!ids.length) return {};
    const state = await readCosmeticsCache();
    const idsToFetch = ids.filter((id) => !state.records[id] || !isFresh(state.fetchedAt[id], PROFILE_CACHE_TTL_MS));
    const now = Date.now();
    const cooledIdsToFetch = idsToFetch.filter((id) => now - Number(lastRefreshAttemptAt.get(id) || 0) >= REFRESH_RETRY_MS);
    const skipped = idsToFetch.filter((id) => !cooledIdsToFetch.includes(id));
    if (skipped.length) {
      const cached = {};
      for (const id of ids) if (state.records[id]) cached[id] = state.records[id];
      if (!cooledIdsToFetch.length) return normalizeRecords(cached);
    }
    for (const id of cooledIdsToFetch) lastRefreshAttemptAt.set(id, now);
    if (!cooledIdsToFetch.length) {
      const cached = {};
      for (const id of ids) if (state.records[id]) cached[id] = state.records[id];
      return normalizeRecords(cached);
    }
    const key = cooledIdsToFetch.slice().sort((a, b) => a - b).join(",");
    if (inflightUsersRefreshes.has(key)) return inflightUsersRefreshes.get(key);
    const refresh = (async () => {
      const serverRecords = await fetchCosmeticsRecords(cooledIdsToFetch).catch(() => ({}));
      await markCosmeticsChecked(cooledIdsToFetch, Date.now());
      if (Object.keys(serverRecords).length) {
        const before = await readCosmeticsCache();
        await cacheCosmeticsRecords(serverRecords, Date.now());
        for (const [id, record] of Object.entries(serverRecords)) {
          if (JSON.stringify(before.records?.[id] || null) !== JSON.stringify(record)) {
            dispatchCosmeticsUpdate(Number(id), record);
          }
        }
      }
      const latest = await readCosmeticsCache();
      const out = {};
      for (const id of ids) {
        if (serverRecords[id]) out[id] = serverRecords[id];
        else if (latest.records[id]) out[id] = latest.records[id];
      }
      return normalizeRecords(out);
    })().finally(() => inflightUsersRefreshes.delete(key));
    inflightUsersRefreshes.set(key, refresh);
    return refresh;
  }

  async function readCosmeticsCache() {
    const stored = await readStorage([STORAGE_KEY]);
    return normalizeCache(stored[STORAGE_KEY] || {});
  }

  async function writeCosmeticsCache(cache) {
    const normalized = normalizeCache(cache);
    await writeStorage({
      [STORAGE_KEY]: {
        ownUserId: normalized.ownUserId,
        ownUserFetchedAt: normalized.ownUserFetchedAt,
        version: CACHE_VERSION,
        records: normalized.records,
        fetchedAt: normalized.fetchedAt
      }
    });
    return normalized;
  }

  async function cacheCosmeticsRecords(records, fetchedAt) {
    const saved = await readCosmeticsCache();
    const nextRecords = { ...(saved.records || {}) };
    const nextFetchedAt = { ...(saved.fetchedAt || {}) };
    for (const [userId, record] of Object.entries(records || {})) {
      const normalized = normalizeRecord({ ...record, userId: Number(userId) || Number(record?.userId) });
      if (!normalized) continue;
      nextRecords[normalized.userId] = normalized;
      nextFetchedAt[normalized.userId] = Number(fetchedAt) || Date.now();
    }
    return writeCosmeticsCache({ ...saved, records: nextRecords, fetchedAt: nextFetchedAt });
  }

  async function markCosmeticsChecked(userIds, fetchedAt) {
    const saved = await readCosmeticsCache();
    const nextFetchedAt = { ...(saved.fetchedAt || {}) };
    for (const userId of userIds || []) {
      const id = Number(userId);
      if (Number.isFinite(id) && id > 0) {
        nextFetchedAt[id] = Number(fetchedAt) || Date.now();
      }
    }
    return writeCosmeticsCache({ ...saved, fetchedAt: nextFetchedAt });
  }

  async function removeCosmeticsRecord(userId) {
    const id = Number(userId);
    if (!Number.isFinite(id) || id <= 0) return readCosmeticsCache();
    const saved = await readCosmeticsCache();
    const nextRecords = { ...(saved.records || {}) };
    const nextFetchedAt = { ...(saved.fetchedAt || {}) };
    delete nextRecords[id];
    delete nextFetchedAt[id];
    return writeCosmeticsCache({ ...saved, records: nextRecords, fetchedAt: nextFetchedAt });
  }

  function normalizeCache(saved) {
    if (Number(saved.version || 0) !== CACHE_VERSION) {
      return {
        version: CACHE_VERSION,
        ownUserId: Number.isFinite(Number(saved.ownUserId)) ? Number(saved.ownUserId) : null,
        ownUserFetchedAt: Number.isFinite(Number(saved.ownUserFetchedAt)) ? Number(saved.ownUserFetchedAt) : 0,
        records: normalizeRecords(DEFAULT_RECORDS),
        fetchedAt: {}
      };
    }
    const records = { ...DEFAULT_RECORDS };
    for (const [userId, record] of Object.entries(saved.records || {})) {
      records[userId] = mergeRecord(records[userId], record, { replaceBadges: true });
    }
    return {
      version: CACHE_VERSION,
      ownUserId: Number.isFinite(Number(saved.ownUserId)) ? Number(saved.ownUserId) : null,
      ownUserFetchedAt: Number.isFinite(Number(saved.ownUserFetchedAt)) ? Number(saved.ownUserFetchedAt) : 0,
      records: normalizeRecords(records),
      fetchedAt: normalizeFetchedAt(saved.fetchedAt || {})
    };
  }

  function normalizeFetchedAt(value) {
    const out = {};
    for (const [userId, timestamp] of Object.entries(value || {})) {
      const id = Number(userId);
      const time = Number(timestamp);
      if (Number.isFinite(id) && id > 0 && Number.isFinite(time) && time > 0) {
        out[id] = time;
      }
    }
    return out;
  }

  function isFresh(timestamp, ttlMs) {
    const time = Number(timestamp);
    return Number.isFinite(time) && time > 0 && Date.now() - time <= ttlMs;
  }

  function dispatchCosmeticsUpdate(userId, record) {
    try {
      globalThis.dispatchEvent(new CustomEvent("vortex-web-cosmetics-updated", {
        detail: { userId: Number(userId), record }
      }));
    } catch {}
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
    let token = await profileAuthToken(userId);
    if (!token) return null;
    const res = await fetch(`${API_BASE}/community/profile/${encodeURIComponent(userId)}`, {
      method: "POST",
      credentials: "omit",
      cache: "no-store",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify(remoteRecordPayload(record))
    });
    if (res.status === 401 || res.status === 403) {
      await clearProfileAuthToken(userId);
      token = await requestProfileAuthToken(userId).catch(() => "");
      if (!token) return null;
      const retry = await fetch(`${API_BASE}/community/profile/${encodeURIComponent(userId)}`, {
        method: "POST",
        credentials: "omit",
        cache: "no-store",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify(remoteRecordPayload(record))
      });
      if (!retry.ok) return null;
      const retryData = await retry.json();
      return normalizeRecord(retryData.profile);
    }
    if (!res.ok) return null;
    const data = await res.json();
    return normalizeRecord(data.profile);
  }

  async function profileAuthToken(userId) {
    const id = Number(userId);
    if (!Number.isFinite(id) || id <= 0) return "";
    const auth = await readProfileAuth();
    const current = auth.records?.[id];
    if (current?.token && Number(current.expiresAt || 0) > Math.floor(Date.now() / 1000) + 60) {
      return String(current.token);
    }
    return requestProfileAuthToken(id);
  }

  async function requestProfileAuthToken(userId) {
    const id = Number(userId);
    if (!Number.isFinite(id) || id <= 0) return "";
    const config = await readLicenseConfig();
    if (!config.licenseKey && !config.lease) return "";
    const fingerprintHash = await browserFingerprintHash();
    const res = await fetch(`${API_BASE}/community/auth/token`, {
      method: "POST",
      credentials: "omit",
      cache: "no-store",
      headers: {
        accept: "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        license_key: config.licenseKey,
        fingerprint_hash: fingerprintHash,
        lease: config.lease || null,
        userId: id
      })
    });
    if (!res.ok) return "";
    const data = await res.json();
    const token = String(data.token || "");
    const expiresAt = Number(data.expiresAt || 0);
    if (!token || !expiresAt) return "";
    const auth = await readProfileAuth();
    await writeStorage({
      [PROFILE_AUTH_KEY]: {
        ...auth,
        records: {
          ...(auth.records || {}),
          [id]: { token, expiresAt, userId: id, username: String(data.username || "") }
        }
      }
    });
    return token;
  }

  async function unlinkProfileAuth(userId) {
    const id = Number(userId);
    if (!Number.isFinite(id) || id <= 0) return false;
    const token = await profileAuthToken(id);
    if (!token) return false;
    const res = await fetch(`${API_BASE}/community/auth/unlink`, {
      method: "POST",
      credentials: "omit",
      cache: "no-store",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ userId: id })
    });
    await clearProfileAuthToken(id);
    return res.ok;
  }

  async function hasProfileAuth(userId) {
    const id = Number(userId);
    if (!Number.isFinite(id) || id <= 0) return false;
    const auth = await readProfileAuth();
    const current = auth.records?.[id];
    return !!(current?.token && Number(current.expiresAt || 0) > Math.floor(Date.now() / 1000) + 60);
  }

  async function readProfileAuth() {
    const stored = await readStorage([PROFILE_AUTH_KEY]);
    const saved = stored[PROFILE_AUTH_KEY] || {};
    return {
      records: saved && typeof saved === "object" && saved.records && typeof saved.records === "object"
        ? saved.records
        : {}
    };
  }

  async function clearProfileAuthToken(userId) {
    const auth = await readProfileAuth();
    const records = { ...(auth.records || {}) };
    delete records[Number(userId)];
    await writeStorage({ [PROFILE_AUTH_KEY]: { ...auth, records } });
  }

  async function readLicenseConfig() {
    const fallback = { licenseKey: "", [LAST_LICENSE_LEASE_KEY]: null };
    const api = globalThis.chrome || globalThis.browser;
    if (!api?.storage?.local) return fallback;
    let stored = await api.storage.local.get(fallback);
    if (!stored.licenseKey && api.storage.sync) {
      try {
        const synced = await api.storage.sync.get(fallback);
        stored = {
          ...synced,
          ...Object.fromEntries(Object.entries(stored).filter(([, value]) => value !== "" && value != null))
        };
      } catch {}
    }
    const savedLease = stored[LAST_LICENSE_LEASE_KEY];
    const lease = savedLease && typeof savedLease === "object" ? savedLease.lease || null : null;
    return { licenseKey: String(stored.licenseKey || "").trim(), lease };
  }

  async function browserFingerprintHash() {
    const api = globalThis.chrome || globalThis.browser;
    let installId = "";
    if (api?.storage?.local) {
      const stored = await api.storage.local.get({ vwebInstallId: "" });
      installId = String(stored.vwebInstallId || "");
      if (!installId) {
        installId = crypto.randomUUID ? crypto.randomUUID() : randomHex(16);
        await api.storage.local.set({ vwebInstallId: installId });
      }
    }
    const material = `vortex-web-install\n${installId}`;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function randomHex(bytes) {
    const values = new Uint8Array(bytes);
    crypto.getRandomValues(values);
    return [...values].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function remoteRecordPayload(record) {
    const selectedBadge = (Array.isArray(record.badges) ? record.badges : []).find((badge) => badge?.selected);
    const payload = {
      userId: record.userId,
      badges: Array.isArray(record.badges) ? record.badges : [],
      selectedBadgeId: selectedBadge ? String(selectedBadge.id || selectedBadge.kind || "") : ""
    };
    if (hasOwn(record, "nameEffect")) payload.nameEffect = record.nameEffect || "";
    if (hasOwn(record, "nameGradient")) payload.nameGradient = Array.isArray(record.nameGradient) ? record.nameGradient : [];
    if (hasOwn(record, "badgeEffect")) payload.badgeEffect = record.badgeEffect || "";
    if (hasOwn(record, "badgeGradient")) payload.badgeGradient = Array.isArray(record.badgeGradient) ? record.badgeGradient : [];
    if (hasOwn(record, "nameplateUrl")) payload.nameplateUrl = record.nameplateUrl || "";
    if (hasOwn(record, "profileBackgroundUrl")) payload.profileBackgroundUrl = record.profileBackgroundUrl || "";
    return payload;
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

  async function fetchOwnUserIdOnce() {
    if (inflightOwnUserId) return inflightOwnUserId;
    inflightOwnUserId = fetchOwnUserId().finally(() => {
      inflightOwnUserId = null;
    });
    return inflightOwnUserId;
  }

  function selectedBadge(record) {
    return record?.badges?.find((badge) => badge.selected) || null;
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
    const rawId = String(effectId || "none").toLowerCase();
    const id = LEGACY_NAME_EFFECTS[rawId] || rawId;
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
      loadCached: loadCachedCosmeticsState,
      loadUser: loadCosmeticsUser,
      loadUsers: loadCosmeticsUsers,
      refreshUser: refreshCosmeticsUser,
      refreshUsers: refreshCosmeticsUsers,
      saveRecord: saveCosmeticsRecord,
      unlinkProfileAuth,
      hasProfileAuth,
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

  const api = cosmeticsApi();
  globalThis.VortexWebCosmetics = api;

  globalThis.addEventListener("message", async (event) => {
    const message = event.data;
    if (!message || message.source !== "vortex-web-page" || message.type !== "vortex-web-cosmetics:load-users") return;
    const requestId = String(message.requestId || "");
    const ids = Array.isArray(message.userIds) ? message.userIds : [];
    if (!requestId || !ids.length) return;
    const cleanIds = [...new Set(ids.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0))]
      .slice(0, 100)
      .sort((a, b) => a - b);
    if (!cleanIds.length) return;
    const key = cleanIds.join(",");
    try {
      const cached = bridgeResponseCache.get(key);
      if (cached && Date.now() - cached.at <= BRIDGE_RESPONSE_TTL_MS) {
        globalThis.postMessage({
          source: "vortex-web-extension",
          type: "vortex-web-cosmetics:users",
          requestId,
          records: cached.records
        }, globalThis.location.origin);
        return;
      }
      if (!inflightBridgeRequests.has(key)) {
        inflightBridgeRequests.set(key, api.loadUsers(cleanIds).finally(() => inflightBridgeRequests.delete(key)));
      }
      const records = await inflightBridgeRequests.get(key);
      bridgeResponseCache.set(key, { at: Date.now(), records });
      globalThis.postMessage({
        source: "vortex-web-extension",
        type: "vortex-web-cosmetics:users",
        requestId,
        records
      }, globalThis.location.origin);
    } catch (error) {
      globalThis.postMessage({
        source: "vortex-web-extension",
        type: "vortex-web-cosmetics:users",
        requestId,
        records: {},
        error: String(error?.message || error || "failed")
      }, globalThis.location.origin);
    }
  });
})();
