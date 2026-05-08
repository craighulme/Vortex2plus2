(async function () {
    const url = new URL(document.URL);
    const query = url.searchParams.get("q");
    if(query) return;
    document.getElementById('results-area').style.opacity='0';
    async function userExists(id) {
        try {
            const res = await fetch('/api/users/' + id);
            return res.status !== 404;
        } catch { }
    }

    async function getLatestUser(max = 10000) {
        let low = 1, high = max, highest = 0;
        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (await userExists(mid)) {
                highest = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }
        return highest;
    }

    const maxUserId = await getLatestUser();

    const batchSize = 11;
    let currentId = 1;
    let loading = false;
    let oldestFirst = true;

    let container = document.getElementById('my-user-list-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'my-user-list-container';
        container.style.padding = '0';
        container.style.background = 'var(--bgcol1)';
        container.style.borderRadius = '6px';
        const resultsArea = document.getElementById('results-area');
        resultsArea.insertAdjacentElement('afterend', container);
    }
    container.innerHTML = '';

    let header = document.createElement('div');
    Object.assign(header.style, {
        display: 'flex',
        alightItems: 'center',

        marginBottom: '12px',
        gap: '6px'
    })

    let defStyle = {
        padding: '4px 6px',
        background: 'var(--bgcol2)',
        color: 'white',
        border: '0',
        borderRadius: '4px',
        cursor: 'pointer'
    };

    const userIdInput = document.createElement('input');
    Object.assign(userIdInput.style,defStyle);
    userIdInput.type = 'number';
    userIdInput.placeholder = 'User ID';
    userIdInput.style.width = '80px';



    const searchButton = document.createElement('button');
    Object.assign(searchButton.style, defStyle)

    const sortSelector = document.createElement('select');
    Object.assign(sortSelector.style, defStyle)
    sortSelector.value = 1
    const oldestOption = document.createElement('option')
    oldestOption.innerText = 'sort oldest'
    oldestOption.value = 1
    const newestOption = document.createElement('option')
    newestOption.innerText = 'sort newest'
    newestOption.value = 2

    sortSelector.appendChild(oldestOption)
    sortSelector.appendChild(newestOption)
    header.appendChild(userIdInput);
    header.appendChild(sortSelector);
    container.appendChild(header);

    const list = document.createElement('div');
    list.className = 'user-list';
    container.appendChild(list);

    let friends = new Set();
    try {
        const myFriends = await fetch('/api/friends').then(r => r.ok ? r.json() : []);
        friends = new Set(myFriends.map(f => f.id));
    } catch { }

    function avatarColor(username) {
        const colors = ['rgb(8,145,178)', 'rgb(147,51,234)', 'rgb(217,119,6)', 'rgb(37,99,235)', 'rgb(26,26,26)'];
        return colors[username.charCodeAt(0) % colors.length];
    }

    function initial(username) {
        return username[0].toUpperCase();
    }

    function buildActions(user) {
        const wrap = document.createElement('div');
        wrap.className = 'user-row-actions';
        wrap.dataset.userId = user.id;
        wrap.dataset.status = friends.has(user.id) ? 'friends' : 'none';
        wrap.innerHTML = '';
        const status = wrap.dataset.status;
        if (status === 'friends') {
            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.textContent = 'Friends';
            wrap.appendChild(tag);
        } else if (status === 'none') {
            const btn = document.createElement('button');
            btn.className = 'btn-primary';
            btn.textContent = 'Add Friend';
            btn.onclick = async function() {
                btn.disabled = true;
                btn.textContent = '...';
                const res = await fetch(`/api/friends/request/${user.id}`, { method: 'POST' });
                const data = await res.json();
                if (data.result === 'accepted') {
                    friends.add(user.id);
                    wrap.innerHTML = '<span class="tag">Friends</span>';
                } else if (res.ok) {
                    btn.textContent = 'Requested';
                    btn.className = 'btn-secondary';
                } else {
                    btn.disabled = false;
                    btn.textContent = 'Add Friend';
                }
            };
            wrap.appendChild(btn);
        }
        return wrap;
    }

    async function fetchUser(id) {
        try {
            const res = await fetch(`/api/users/${id}`);
            if (!res.ok) return null;
            const user = await res.json();
            if (!user || !user.username) return null;
            return user;
        } catch { return null; }
    }

    async function loadBatch() {
        if (loading || (oldestFirst && currentId > maxUserId) || (!oldestFirst && currentId < 1)) return;
        loading = true;

        const batchEnd = oldestFirst ? Math.min(currentId + batchSize - 1, maxUserId) : Math.max(currentId - batchSize + 1, 1);
        const placeholders = [];

        for (let id = currentId; oldestFirst ? id <= batchEnd : id >= batchEnd; oldestFirst ? id++ : id--) {
            const row = document.createElement('div');
            row.className = 'user-row';
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.marginBottom = '6px';
            row.style.padding = '4px';
            row.style.borderRadius = '6px';
            row.style.background = 'var(--bgcol2)';
            row.style.borderColor = 'var(--linecol2)'

            const idBox = document.createElement('div');
            idBox.textContent = `#${id}`;
            idBox.style.marginRight = '8px';
            idBox.style.color = 'var(--textcol2)';
            row.appendChild(idBox);

            const avatar = document.createElement('div');
            avatar.style.width = '36px';
            avatar.style.height = '36px';
            avatar.style.borderRadius = '50%';
            avatar.style.marginRight = '8px';
            avatar.style.background = '#666';
            avatar.style.display = 'flex';
            avatar.style.alignItems = 'center';
            avatar.style.justifyContent = 'center';
            avatar.style.color = 'white';
            avatar.style.fontWeight = 'bold';
            row.appendChild(avatar);

            const name = document.createElement('div');
            name.style.flex = '1';
            name.style.color = 'white';
            name.style.fontWeight = '500';
            name.style.textDecoration = 'none';
            row.appendChild(name);

            const actions = document.createElement('div');
            actions.className = 'user-row-actions';
            row.appendChild(actions);

            list.appendChild(row);
            placeholders.push({ row, id, avatar, name, actions });
        }

        currentId = oldestFirst ? batchEnd + 1 : batchEnd - 1;
        const users = await Promise.all(placeholders.map(ph => fetchUser(ph.id)));

        for (let i = 0; i < placeholders.length; i++) {
            const ph = placeholders[i];
            const u = users[i];
            if (!u) continue;

            const avatarLink = document.createElement('a');
            avatarLink.href = `/users/${u.id}/profile`;
            avatarLink.style.display = 'flex';
            avatarLink.style.alignItems = 'center';
            avatarLink.style.justifyContent = 'center';
            avatarLink.style.marginRight = '8px';
            avatarLink.style.width = '36px';
            avatarLink.style.height = '36px';
            avatarLink.style.borderRadius = '50%';
            avatarLink.style.overflow = 'hidden';
            avatarLink.style.background = avatarColor(u.username);
            avatarLink.style.textDecoration = 'none';
            avatarLink.style.lineHeight = '1';

            const avatarText = document.createElement('div');
            avatarText.textContent = initial(u.username);
            avatarText.style.color = 'white';
            avatarText.style.fontWeight = 'bold';
            avatarText.style.display = 'flex';
            avatarText.style.alignItems = 'center';
            avatarText.style.justifyContent = 'center';
            avatarText.style.width = '100%';
            avatarText.style.height = '100%';
            avatarText.style.fontSize = '16px';

            avatarLink.appendChild(avatarText);
            ph.row.replaceChild(avatarLink, ph.avatar);

            const nameLink = document.createElement('a');
            nameLink.href = `/users/${u.id}/profile`;
            nameLink.textContent = u.username;
            nameLink.style.color = 'var(--textcol1)';
            nameLink.style.textDecoration = 'none';
            nameLink.style.fontWeight = '500';
            ph.row.replaceChild(nameLink, ph.name);

            const actions = buildActions(u);
            ph.row.replaceChild(actions, ph.actions);
        }

        loading = false;
    }

    function checkScroll() {
        if (loading) return;
        const scrollTop = window.scrollY;
        const windowHeight = window.innerHeight;
        const docHeight = document.documentElement.scrollHeight;
        if (scrollTop + windowHeight > docHeight - 300 || docHeight <= windowHeight) loadBatch();
    }

    window.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);
    setInterval(checkScroll, 200);

    searchButton.onclick = function() {
        const id = parseInt(userIdInput.value);
        if (id > 0 && id <= maxUserId) {
            currentId = id;
            list.innerHTML = '';
            loadBatch();
        }
    };

    userIdInput.addEventListener('keypress', e => { if (e.key === 'Enter') searchButton.click(); });
    sortSelector.onchange = function() {
        if (sortSelector.value == '1') {
            oldestFirst = true; currentId = 1; list.innerHTML = ''; loadBatch();
        } else {
            oldestFirst = false; currentId = maxUserId; list.innerHTML = ''; loadBatch();
        }
    }

    await loadBatch();
})();