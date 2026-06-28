type VortexUser = {
  id: number;
  username: string;
};

type FriendRecord = {
  id: number;
};

const batchSize = 11;

export function installSearchEnhancement(documentRef: Document = document, windowRef: Window = window, fetcher: typeof fetch = fetch): void {
  void bootSearchEnhancement(documentRef, windowRef, fetcher);
}

async function bootSearchEnhancement(documentRef: Document, windowRef: Window, fetcher: typeof fetch): Promise<void> {
  const url = new URL(documentRef.URL);
  if (url.pathname !== "/search") return;
  if (url.searchParams.get("q")) return;

  const resultsArea = documentRef.getElementById("results-area");
  if (!resultsArea) return;
  resultsArea.style.opacity = "0";

  const maxUserId = await getLatestUser(fetcher);
  let currentId = 1;
  let loading = false;
  let oldestFirst = true;
  const friends = await fetchFriends(fetcher);
  const container = ensureContainer(documentRef, resultsArea);
  const { userIdInput, sortSelector, list } = buildShell(documentRef, container);

  async function loadBatch(): Promise<void> {
    if (loading || (oldestFirst && currentId > maxUserId) || (!oldestFirst && currentId < 1)) return;
    loading = true;

    const batchEnd = oldestFirst ? Math.min(currentId + batchSize - 1, maxUserId) : Math.max(currentId - batchSize + 1, 1);
    const placeholders = [];

    for (let id = currentId; oldestFirst ? id <= batchEnd : id >= batchEnd; oldestFirst ? id++ : id--) {
      const row = buildPlaceholderRow(documentRef, id);
      list.appendChild(row.row);
      placeholders.push({ ...row, id });
    }

    currentId = oldestFirst ? batchEnd + 1 : batchEnd - 1;
    const users = await Promise.all(placeholders.map((placeholder) => fetchUser(fetcher, placeholder.id)));

    for (let i = 0; i < placeholders.length; i++) {
      const placeholder = placeholders[i];
      const user = users[i];
      if (!placeholder || !user) continue;
      hydrateRow(documentRef, placeholder, user, friends, fetcher);
    }

    loading = false;
  }

  function checkScroll(): void {
    if (loading) return;
    const scrollTop = windowRef.scrollY;
    const windowHeight = windowRef.innerHeight;
    const docHeight = documentRef.documentElement.scrollHeight;
    if (scrollTop + windowHeight > docHeight - 300 || docHeight <= windowHeight) void loadBatch();
  }

  windowRef.addEventListener("scroll", checkScroll);
  windowRef.addEventListener("resize", checkScroll);
  windowRef.setInterval(checkScroll, 200);

  userIdInput.addEventListener("keypress", (event) => {
    if (event.key === "Enter") resetTo(Number.parseInt(userIdInput.value, 10));
  });

  sortSelector.addEventListener("change", () => {
    oldestFirst = sortSelector.value === "1";
    currentId = oldestFirst ? 1 : maxUserId;
    list.innerHTML = "";
    void loadBatch();
  });

  await loadBatch();

  function resetTo(id: number): void {
    if (id > 0 && id <= maxUserId) {
      currentId = id;
      list.innerHTML = "";
      void loadBatch();
    }
  }
}

async function userExists(fetcher: typeof fetch, id: number): Promise<boolean> {
  try {
    const res = await fetcher(`/api/users/${id}`);
    return res.status !== 404;
  } catch {
    return false;
  }
}

async function getLatestUser(fetcher: typeof fetch, max = 100000): Promise<number> {
  let low = 1;
  let high = max;
  let highest = 0;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (await userExists(fetcher, mid)) {
      highest = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return highest;
}

async function fetchFriends(fetcher: typeof fetch): Promise<Set<number>> {
  try {
    const res = await fetcher("/api/friends");
    const friends = res.ok ? await res.json() as FriendRecord[] : [];
    return new Set(friends.map((friend) => Number(friend.id)).filter(Number.isFinite));
  } catch {
    return new Set();
  }
}

function ensureContainer(documentRef: Document, resultsArea: HTMLElement): HTMLElement {
  let container = documentRef.getElementById("my-user-list-container");
  if (!container) {
    container = documentRef.createElement("div");
    container.id = "my-user-list-container";
    container.style.padding = "0";
    container.style.background = "var(--bgcol1)";
    container.style.borderRadius = "6px";
    resultsArea.insertAdjacentElement("afterend", container);
  }
  container.innerHTML = "";
  return container;
}

function buildShell(documentRef: Document, container: HTMLElement): {
  userIdInput: HTMLInputElement;
  sortSelector: HTMLSelectElement;
  list: HTMLDivElement;
} {
  const header = documentRef.createElement("div");
  Object.assign(header.style, {
    display: "flex",
    alignItems: "center",
    marginBottom: "12px",
    gap: "6px"
  });

  const controlStyle = {
    padding: "4px 6px",
    background: "var(--bgcol2)",
    color: "white",
    border: "0",
    borderRadius: "4px",
    cursor: "pointer"
  };

  const userIdInput = documentRef.createElement("input");
  Object.assign(userIdInput.style, controlStyle);
  userIdInput.type = "number";
  userIdInput.placeholder = "User ID";
  userIdInput.style.width = "80px";

  const sortSelector = documentRef.createElement("select");
  Object.assign(sortSelector.style, controlStyle);
  sortSelector.value = "1";
  sortSelector.appendChild(option(documentRef, "sort oldest", "1"));
  sortSelector.appendChild(option(documentRef, "sort newest", "2"));

  header.appendChild(userIdInput);
  header.appendChild(sortSelector);
  container.appendChild(header);

  const list = documentRef.createElement("div");
  list.className = "user-list";
  container.appendChild(list);

  return { userIdInput, sortSelector, list };
}

function option(documentRef: Document, label: string, value: string): HTMLOptionElement {
  const item = documentRef.createElement("option");
  item.innerText = label;
  item.value = value;
  return item;
}

function buildPlaceholderRow(documentRef: Document, id: number) {
  const row = documentRef.createElement("div");
  row.className = "user-row";
  Object.assign(row.style, {
    display: "flex",
    alignItems: "center",
    marginBottom: "6px",
    padding: "4px",
    borderRadius: "6px",
    background: "var(--bgcol2)",
    borderColor: "var(--linecol2)"
  });

  const idBox = documentRef.createElement("div");
  idBox.textContent = `#${id}`;
  idBox.style.marginRight = "8px";
  idBox.style.color = "var(--textcol2)";
  row.appendChild(idBox);

  const avatar = documentRef.createElement("div");
  Object.assign(avatar.style, {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    marginRight: "8px",
    background: "#666",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontWeight: "bold"
  });
  row.appendChild(avatar);

  const name = documentRef.createElement("div");
  name.style.flex = "1";
  name.style.color = "white";
  name.style.fontWeight = "500";
  name.style.textDecoration = "none";
  row.appendChild(name);

  const actions = documentRef.createElement("div");
  actions.className = "user-row-actions";
  row.appendChild(actions);

  return { row, avatar, name, actions };
}

async function fetchUser(fetcher: typeof fetch, id: number): Promise<VortexUser | null> {
  try {
    const res = await fetcher(`/api/users/${id}`);
    if (!res.ok) return null;
    const user = await res.json() as Partial<VortexUser>;
    if (!user || !user.username) return null;
    return { id: Number(user.id) || id, username: String(user.username) };
  } catch {
    return null;
  }
}

function hydrateRow(
  documentRef: Document,
  placeholder: ReturnType<typeof buildPlaceholderRow>,
  user: VortexUser,
  friends: Set<number>,
  fetcher: typeof fetch
): void {
  const avatarLink = documentRef.createElement("a");
  avatarLink.href = `/users/${user.id}/profile`;
  Object.assign(avatarLink.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginRight: "8px",
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    overflow: "hidden",
    background: avatarColor(user.username),
    textDecoration: "none",
    lineHeight: "1"
  });

  const avatarText = documentRef.createElement("div");
  avatarText.textContent = initial(user.username);
  Object.assign(avatarText.style, {
    color: "white",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    fontSize: "16px"
  });
  avatarLink.appendChild(avatarText);
  placeholder.row.replaceChild(avatarLink, placeholder.avatar);

  const nameLink = documentRef.createElement("a");
  nameLink.href = `/users/${user.id}/profile`;
  nameLink.textContent = user.username;
  nameLink.style.color = "var(--textcol1)";
  nameLink.style.textDecoration = "none";
  nameLink.style.fontWeight = "500";
  placeholder.row.replaceChild(nameLink, placeholder.name);
  placeholder.row.replaceChild(buildActions(documentRef, user, friends, fetcher), placeholder.actions);
}

function buildActions(documentRef: Document, user: VortexUser, friends: Set<number>, fetcher: typeof fetch): HTMLElement {
  const wrap = documentRef.createElement("div");
  wrap.className = "user-row-actions";
  wrap.dataset.userId = String(user.id);
  wrap.dataset.status = friends.has(user.id) ? "friends" : "none";
  if (wrap.dataset.status === "friends") {
    const tag = documentRef.createElement("span");
    tag.className = "tag";
    tag.textContent = "Friends";
    wrap.appendChild(tag);
    return wrap;
  }

  const btn = documentRef.createElement("button");
  btn.className = "btn-primary";
  btn.textContent = "Add Friend";
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = "...";
    const res = await fetcher(`/api/friends/request/${user.id}`, { method: "POST" });
    const data = await res.json().catch(() => null) as { result?: string } | null;
    if (data?.result === "accepted") {
      friends.add(user.id);
      wrap.innerHTML = "";
      const tag = documentRef.createElement("span");
      tag.className = "tag";
      tag.textContent = "Friends";
      wrap.appendChild(tag);
    } else if (res.ok) {
      btn.textContent = "Requested";
      btn.className = "btn-secondary";
    } else {
      btn.disabled = false;
      btn.textContent = "Add Friend";
    }
  });
  wrap.appendChild(btn);
  return wrap;
}

function avatarColor(username: string): string {
  const colors = ["rgb(8,145,178)", "rgb(147,51,234)", "rgb(217,119,6)", "rgb(37,99,235)", "rgb(26,26,26)"];
  return colors[username.charCodeAt(0) % colors.length] || colors[0]!;
}

function initial(username: string): string {
  return username[0]?.toUpperCase() || "?";
}
