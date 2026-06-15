(function () {
    const chatWindow = document.getElementById('chat-window');
    const messagesEl = document.getElementById('chat-messages');
    const inputEl    = document.getElementById('chat-input');
    const sendBtn    = document.getElementById('chat-send');
    const toggleBtn  = document.getElementById('chat-toggle-btn');
    const badge      = document.getElementById('unread-badge');

    let isOpen = true;
    let unread = 0;

    let chatValue = '';
    let selAnchor = 0;
    let selFocus  = 0;
    let _active   = false;

    function selStart() { return Math.min(selAnchor, selFocus); }
    function selEnd()   { return Math.max(selAnchor, selFocus); }
    function hasSelection() { return selAnchor !== selFocus; }

    function clamp(v) { return Math.max(0, Math.min(chatValue.length, v)); }

    function renderDisplay() {
        const s = selStart(), e = selEnd();
        const showPlaceholder = chatValue.length === 0 && !_active;

        if (showPlaceholder) {
            inputEl.innerHTML = '<span class="chat-placeholder">Click or press / to chat</span>';
            return;
        }

        let html = '';
        if (hasSelection()) {
            html += esc(chatValue.slice(0, s));
            html += `<span class="chat-sel">${esc(chatValue.slice(s, e))}</span>`;
            html += esc(chatValue.slice(e));
        } else {
            const pos = selFocus;
            html += esc(chatValue.slice(0, pos));
            if (_active) html += '<span class="chat-caret"></span>';
            html += esc(chatValue.slice(pos));
        }
        inputEl.innerHTML = html;
    }

    function insertText(str) {
        const s = selStart(), e = selEnd();
        chatValue = chatValue.slice(0, s) + str + chatValue.slice(e);
        const newPos = clamp(s + str.length);
        selAnchor = selFocus = newPos;
        renderDisplay();
    }

    function deleteRange(s, e) {
        chatValue = chatValue.slice(0, s) + chatValue.slice(e);
        selAnchor = selFocus = clamp(s);
        renderDisplay();
    }

    const NAME_COLORS = ['#60a5fa','#34d399','#f87171','#fbbf24','#a78bfa','#fb923c','#f472b6'];
    function nameColor(name) {
        let h = 0;
        for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xFFFF;
        return NAME_COLORS[h % NAME_COLORS.length];
    }

    function esc(s) {
        return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function scrollBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }

    function append(html) {
        const atBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 60;
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        messagesEl.appendChild(tmp.firstChild);
        if (atBottom) scrollBottom();
        if (!isOpen) {
            unread = Math.min(unread + 1, 99);
            badge.textContent = unread >= 99 ? '99+' : String(unread);
            badge.classList.remove('hidden');
        }
    }

    function message(username, text, isSelf, isStaff, isOwner) {
        let nameHtml;
        if (isOwner) {
            nameHtml = `<span class="msg-name msg-gradient-owner">${esc(username)}</span>`;
        } else if (isStaff) {
            nameHtml = `<span class="msg-name msg-gradient-staff">${esc(username)}</span>`;
        } else {
            const col = isSelf ? '#fff' : nameColor(username);
            nameHtml = `<span class="msg-name" style="color:${col}">${esc(username)}</span>`;
        }
        append(`<div class="msg${isSelf ? ' msg-self' : ''}">${nameHtml}: <span class="msg-text">${esc(text)}</span></div>`);
    }

    function system(text) {
        append(`<div class="msg-system">${esc(text)}</div>`);
    }

    function systemPlayer(username,text,isSelf) {
        append(`<div class="msg-system">${esc(text).replace(username,`<b>${username}</b>`)}</div>`);
    }

    function systemRed(text) {
        append(`<div class="msg-system-red">${esc(text)}</div>`);
    }

    let _warnTimer = null;
    const warnEl = document.createElement('div');
    warnEl.className = 'chat-warn hidden';
    chatWindow.appendChild(warnEl);

    function warn(text) {
        warnEl.textContent = text;
        warnEl.classList.remove('hidden');
        clearTimeout(_warnTimer);
        _warnTimer = setTimeout(() => warnEl.classList.add('hidden'), 3000);
    }

    function openChat() {
        isOpen = true;
        chatWindow.classList.remove('hidden');
        unread = 0;
        badge.classList.add('hidden');
        scrollBottom();
    }

    function closeChat() {
        isOpen = false;
        chatWindow.classList.add('hidden');
        deactivateChat();
    }

    toggleBtn.addEventListener('click', () => isOpen ? closeChat() : openChat());

    function send() {
        const text = chatValue.trim();
        if (!text) {
            deactivateChat();
            return;
        }
        window._mpSendChat?.(text);
        chatValue = '';
        selAnchor = selFocus = 0;
        deactivateChat();
    }

    sendBtn.addEventListener('click', send);

    function activateChat() {
        if (!isOpen) openChat();
        _active = true;
        window._chatFocused = true;
        inputEl.classList.add('chat-active');
        renderDisplay();
    }

    function deactivateChat() {
        _active = false;
        window._chatFocused = false;
        inputEl.classList.remove('chat-active');
        renderDisplay();
    }

    document.addEventListener('keydown', e => {
        if (document.pointerLockElement && !_active && e.key === '/') {
            e.preventDefault();
            activateChat();
            return;
        }

        if (!_active) return;
        e.stopPropagation();

        const ctrl = e.ctrlKey || e.metaKey;

        if (e.key === 'Enter') {
            e.preventDefault();
            send();
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            deactivateChat();
            return;
        }

        if (ctrl && e.key === 'a') {
            e.preventDefault();
            selAnchor = 0;
            selFocus  = chatValue.length;
            renderDisplay();
            return;
        }

        if (ctrl && e.key === 'c') {
            if (hasSelection()) {
                navigator.clipboard?.writeText(chatValue.slice(selStart(), selEnd())).catch(() => {});
            }
            return;
        }

        if (ctrl && e.key === 'x') {
            e.preventDefault();
            if (hasSelection()) {
                navigator.clipboard?.writeText(chatValue.slice(selStart(), selEnd())).catch(() => {});
                deleteRange(selStart(), selEnd());
            }
            return;
        }

        if (ctrl && e.key === 'v') {
            e.preventDefault();
            navigator.clipboard?.readText().then(text => {
                const clean = text.replace(/[\n\r]/g, ' ');
                const remaining = 200 - (chatValue.length - (selEnd() - selStart()));
                insertText(clean.slice(0, remaining));
            }).catch(() => {});
            return;
        }

        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            if (e.shiftKey) {
                selFocus = clamp(selFocus - 1);
            } else {
                if (hasSelection()) selAnchor = selFocus = selStart();
                else selAnchor = selFocus = clamp(selFocus - 1);
            }
            renderDisplay();
            return;
        }

        if (e.key === 'ArrowRight') {
            e.preventDefault();
            if (e.shiftKey) {
                selFocus = clamp(selFocus + 1);
            } else {
                if (hasSelection()) selAnchor = selFocus = selEnd();
                else selAnchor = selFocus = clamp(selFocus + 1);
            }
            renderDisplay();
            return;
        }

        if (e.key === 'Home') {
            e.preventDefault();
            if (e.shiftKey) selFocus = 0;
            else selAnchor = selFocus = 0;
            renderDisplay();
            return;
        }

        if (e.key === 'End') {
            e.preventDefault();
            if (e.shiftKey) selFocus = chatValue.length;
            else selAnchor = selFocus = chatValue.length;
            renderDisplay();
            return;
        }

        if (e.key === 'Backspace') {
            e.preventDefault();
            if (hasSelection()) {
                deleteRange(selStart(), selEnd());
            } else if (selFocus > 0) {
                deleteRange(selFocus - 1, selFocus);
            }
            return;
        }

        if (e.key === 'Delete') {
            e.preventDefault();
            if (hasSelection()) {
                deleteRange(selStart(), selEnd());
            } else if (selFocus < chatValue.length) {
                deleteRange(selFocus, selFocus + 1);
            }
            return;
        }

        if (!ctrl && e.key.length === 1) {
            e.preventDefault();
            const remaining = 200 - (chatValue.length - (selEnd() - selStart()));
            if (remaining > 0) insertText(e.key);
            return;
        }
    });

    window.Chat = {
        message,
        system,
        systemPlayer,
        systemRed,
        clearPlayerMsg: (function(a){}),
        warn,
        open: openChat,
        close: closeChat,
        activate: activateChat,
        deactivate: deactivateChat,
        send };
})();
