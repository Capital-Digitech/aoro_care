/* ==========================================================
   PATIENT PORTAL — MESSAGES
   Conversation list, thread, send and light polling.
   All user text is inserted with textContent (never innerHTML).
========================================================== */

(function () {
    'use strict';

    const dataEl = document.getElementById('hrChatData');

    if (!dataEl) {
        return;
    }

    const D = JSON.parse(dataEl.textContent);

    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    const csrf = csrfMeta ? csrfMeta.content : '';

    const $ = (id) => document.getElementById(id);

    const chatEl = $('hrChat');
    const listBody = $('hrChatListBody');
    const searchEl = $('hrChatSearch');
    const emptyEl = $('hrChatEmpty');
    const panelEl = $('hrChatPanel');
    const headAvatar = $('hrChatHeadAvatar');
    const headName = $('hrChatHeadName');
    const headSub = $('hrChatHeadSub');
    const messagesEl = $('hrChatMessages');
    const formEl = $('hrChatForm');
    const inputEl = $('hrChatInput');
    const sendBtn = $('hrChatSend');
    const statusEl = $('hrChatStatus');
    const countEl = $('hrChatCount');
    const backBtn = $('hrChatBack');

    const DEFAULT_STATUS = statusEl.textContent;
    const POLL_MS = 7000;
    const PALETTE = ['#2563EB', '#10B981', '#7C3AED', '#F59E0B', '#EF4444', '#0EA5E9'];

    let conversations = D.conversations.slice();
    const contacts = D.contacts.slice();

    let activeId = null;
    let activeInfo = null;
    let messages = [];
    let seen = new Set();
    let lastAt = null;
    let sending = false;
    let loadSeq = 0;
    let polling = false;


    /* ---------------- helpers ---------------- */

    function colorFor(text) {
        let h = 0;
        for (let i = 0; i < text.length; i++) {
            h = (h * 31 + text.charCodeAt(i)) >>> 0;
        }
        return PALETTE[h % PALETTE.length];
    }

    function sameDay(a, b) {
        return a.getFullYear() === b.getFullYear() &&
            a.getMonth() === b.getMonth() &&
            a.getDate() === b.getDate();
    }

    function fmtTime(iso) {
        return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function fmtListTime(iso) {
        const d = new Date(iso);
        const now = new Date();
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);

        if (sameDay(d, now)) return fmtTime(iso);
        if (sameDay(d, yesterday)) return 'Yesterday';

        return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
    }

    function dayLabel(iso) {
        const d = new Date(iso);
        const now = new Date();
        const yesterday = new Date();
        yesterday.setDate(now.getDate() - 1);

        if (sameDay(d, now)) return 'Today';
        if (sameDay(d, yesterday)) return 'Yesterday';

        return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function roleLine(p) {
        const label = p.role === 'doctor' ? 'Doctor'
            : p.role === 'family' ? 'Family'
            : 'Patient';
        return p.detail ? label + ' · ' + p.detail : label;
    }

    function threadUrl(id) {
        return D.urls.thread.replace('__ID__', encodeURIComponent(id));
    }

    function el(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function avatar(person) {
        const a = el('div', 'hr-chat-avatar', person.initials || '?');
        a.style.background = colorFor(person.name || '');
        return a;
    }

    function setStatus(text, isError) {
        statusEl.textContent = text;
        statusEl.classList.toggle('hr-chat-error', Boolean(isError));
    }

    async function api(url, options) {
        const opts = Object.assign({
            credentials: 'same-origin',
            headers: {}
        }, options || {});

        opts.headers = Object.assign({
            'Accept': 'application/json',
            'X-CSRFToken': csrf
        }, opts.headers);

        if (opts.body) {
            opts.headers['Content-Type'] = 'application/json';
        }

        try {
            const resp = await fetch(url, opts);

            let data = null;
            try {
                data = await resp.json();
            } catch (e) {
                data = null;
            }

            if (resp.status === 401) {
                window.location.reload();
            }

            return { ok: resp.ok && data && data.ok !== false, status: resp.status, data: data };
        } catch (e) {
            return { ok: false, status: 0, data: null };
        }
    }

    function setUnreadTotal(total) {
        const badge = $('hrMsgNavBadge');
        const dot = $('hrMsgDot');

        if (badge) {
            badge.textContent = total > 0 ? String(total) : '';
            badge.style.display = total > 0 ? '' : 'none';
        }

        if (dot) {
            dot.style.display = total > 0 ? '' : 'none';
        }
    }


    /* ---------------- conversation list ---------------- */

    function listItem(person, preview, time, unread, isActive) {
        const btn = el('button', 'hr-chat-item' + (isActive ? ' active' : ''));
        btn.type = 'button';
        btn.dataset.id = person.user_id;

        btn.appendChild(avatar(person));

        const main = el('div', 'hr-chat-item-main');

        const top = el('div', 'hr-chat-item-top');
        top.appendChild(el('span', 'hr-chat-item-name', person.name));
        if (time) top.appendChild(el('span', 'hr-chat-item-time', time));
        main.appendChild(top);

        const bottom = el('div', 'hr-chat-item-bottom');
        bottom.appendChild(el('span', 'hr-chat-item-preview', preview));
        if (unread > 0) bottom.appendChild(el('span', 'hr-chat-unread', String(unread)));
        main.appendChild(bottom);

        btn.appendChild(main);

        btn.addEventListener('click', () => openChat(person.user_id));

        return btn;
    }

    function matches(q, parts) {
        return !q || parts.some((p) => (p || '').toLowerCase().includes(q));
    }

    function renderList() {
        const q = searchEl.value.trim().toLowerCase();

        listBody.textContent = '';

        const convMatches = conversations.filter((c) =>
            matches(q, [c.name, c.detail, c.last_body])
        );

        const convIds = new Set(conversations.map((c) => c.user_id));

        const people = contacts.filter((p) =>
            !convIds.has(p.user_id) && matches(q, [p.name, p.detail, p.role])
        );

        if (convMatches.length) {
            listBody.appendChild(el('div', 'hr-chat-section', 'Conversations'));

            convMatches.forEach((c) => {
                const preview = (c.last_mine ? 'You: ' : '') +
                    (c.last_body || '').replace(/\s+/g, ' ');

                listBody.appendChild(
                    listItem(c, preview, fmtListTime(c.last_at), c.unread, c.user_id === activeId)
                );
            });
        }

        if (people.length) {
            listBody.appendChild(el('div', 'hr-chat-section', 'Your care team & family'));

            people.forEach((p) => {
                listBody.appendChild(
                    listItem(p, roleLine(p), '', 0, p.user_id === activeId)
                );
            });
        }

        if (!convMatches.length && !people.length) {
            listBody.appendChild(
                el('div', 'hr-chat-noresult',
                    q ? 'No people or messages match your search.'
                        : 'No assigned doctor or linked family member yet.')
            );
        }
    }


    /* ---------------- thread ---------------- */

    function setHeader(person) {
        activeInfo = person;

        headName.textContent = person.name;
        headSub.textContent = roleLine(person);

        headAvatar.textContent = person.initials || '?';
        headAvatar.style.background = colorFor(person.name || '');
    }

    function renderMessages(forceScroll) {
        const nearBottom =
            messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 90;

        messagesEl.textContent = '';

        let lastDay = '';

        messages.forEach((m) => {
            const day = dayLabel(m.created_at);

            if (day !== lastDay) {
                messagesEl.appendChild(el('div', 'hr-chat-day', day));
                lastDay = day;
            }

            const bubble = el('div', 'hr-bubble ' + (m.mine ? 'mine' : 'theirs'));
            bubble.appendChild(document.createTextNode(m.body));
            const time = el('span', 'hr-bubble-time', fmtTime(m.created_at));

            if (m.mine) {
                const tick = el('span', 'hr-tick ' + (m.read ? 'read' : 'sent'));
                tick.title = m.read ? 'Read' : 'Delivered, not read yet';
                tick.appendChild(el('i', m.read ? 'fa-solid fa-check-double' : 'fa-solid fa-check'));
                time.appendChild(tick);
            }

            bubble.appendChild(time);

            messagesEl.appendChild(bubble);
        });

        if (forceScroll || nearBottom) {
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }
    }

    function addMessages(list, forceScroll) {
        let added = false;

        list.forEach((m) => {
            if (!seen.has(m.id)) {
                seen.add(m.id);
                messages.push(m);
                added = true;
            }
        });

        if (messages.length) {
            lastAt = messages[messages.length - 1].created_at;
        }

        if (added || forceScroll) {
            renderMessages(forceScroll);
        }
    }

    function applyReadIds(ids) {
        if (!ids || !ids.length) return;

        const set = new Set(ids);
        let changed = false;

        messages.forEach((m) => {
            if (m.mine && !m.read && set.has(m.id)) {
                m.read = true;
                changed = true;
            }
        });

        if (changed) renderMessages(false);
    }

    function upsertConversation(person, message) {
        let conv = conversations.find((c) => c.user_id === person.user_id);

        if (!conv) {
            conv = {
                user_id: person.user_id,
                name: person.name,
                role: person.role,
                detail: person.detail,
                initials: person.initials,
                unread: 0
            };
            conversations.push(conv);
        }

        conv.last_body = message.body;
        conv.last_at = message.created_at;
        conv.last_mine = true;

        conversations.sort((a, b) => (a.last_at < b.last_at ? 1 : -1));
    }

    async function openChat(id) {
        const known =
            conversations.find((c) => c.user_id === id) ||
            contacts.find((p) => p.user_id === id);

        if (!known) return;

        activeId = id;
        messages = [];
        seen = new Set();
        lastAt = null;

        const seq = ++loadSeq;

        setHeader(known);
        messagesEl.textContent = '';
        emptyEl.classList.add('d-none');
        panelEl.classList.remove('d-none');
        chatEl.classList.add('show-thread');
        setStatus(DEFAULT_STATUS, false);
        renderList();

        const r = await api(threadUrl(id));

        if (seq !== loadSeq) return;

        if (!r.ok) {
            setStatus(
                (r.data && r.data.error) || 'Could not load this conversation. Please try again.',
                true
            );
            return;
        }

        setHeader(r.data.partner);
        addMessages(r.data.messages, true);
        applyReadIds(r.data.read_ids);

        const conv = conversations.find((c) => c.user_id === id);
        if (conv) conv.unread = 0;

        setUnreadTotal(r.data.unread_total);
        renderList();
        inputEl.focus();

        try {
            history.replaceState(null, '', D.urls.page + '?chat=' + encodeURIComponent(id));
        } catch (e) { /* ignore */ }
    }


    /* ---------------- composer ---------------- */

    function autosize() {
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(inputEl.scrollHeight, 140) + 'px';
    }

    function updateComposer() {
        const len = inputEl.value.length;

        sendBtn.disabled = sending || !inputEl.value.trim() || !activeId;

        countEl.textContent = len > D.max_length - 200 ? len + ' / ' + D.max_length : '';
    }

    async function send() {
        if (sending || !activeId) return;

        const body = inputEl.value.trim();

        if (!body) return;

        sending = true;
        updateComposer();
        setStatus('Sending…', false);

        const r = await api(D.urls.send, {
            method: 'POST',
            body: JSON.stringify({ recipient_id: activeId, body: body })
        });

        sending = false;

        if (r.ok && r.data && r.data.message) {
            inputEl.value = '';
            autosize();

            addMessages([r.data.message], true);
            upsertConversation(activeInfo, r.data.message);
            renderList();

            setStatus(DEFAULT_STATUS, false);
        } else {
            let msg = 'Could not send your message. Please try again.';

            if (r.data && r.data.error) {
                msg = r.data.error;
            } else if (r.status === 400 || r.status === 0) {
                msg = 'Could not send. Your session may have expired — please refresh the page.';
            }

            setStatus(msg, true);
        }

        updateComposer();
        inputEl.focus();
    }


    /* ---------------- polling ---------------- */

    async function poll() {
        if (document.hidden || polling || sending) return;

        polling = true;

        try {
            let unreadTotal = null;

            // Thread first: it also marks incoming messages as read.
            if (activeId) {
                const id = activeId;
                const seq = loadSeq;

                const url = threadUrl(id) +
                    (lastAt ? '?after=' + encodeURIComponent(lastAt) : '');

                const t = await api(url);

                if (t.ok && seq === loadSeq && id === activeId) {
                    addMessages(t.data.messages, false);
                    applyReadIds(t.data.read_ids);
                    unreadTotal = t.data.unread_total;
                }
            }

            const c = await api(D.urls.conversations);

            if (c.ok) {
                conversations = c.data.conversations;
                renderList();

                if (unreadTotal === null) unreadTotal = c.data.unread_total;
            }

            if (unreadTotal !== null) setUnreadTotal(unreadTotal);
        } finally {
            polling = false;
        }
    }


    /* ---------------- wiring ---------------- */

    searchEl.addEventListener('input', renderList);

    inputEl.addEventListener('input', () => {
        autosize();
        updateComposer();
    });

    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
            e.preventDefault();
            send();
        }
    });

    formEl.addEventListener('submit', (e) => {
        e.preventDefault();
        send();
    });

    backBtn.addEventListener('click', () => {
        chatEl.classList.remove('show-thread');
    });

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) poll();
    });

    setInterval(poll, POLL_MS);

    renderList();
    setUnreadTotal(conversations.reduce((sum, c) => sum + (c.unread || 0), 0));
    updateComposer();

    if (D.open_with) {
        openChat(D.open_with);
    }

})();
