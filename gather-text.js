export function createText({ db, getUser, getFriends, avatar, hydrateImages, escapeHtml, fail, navigate, onUnread }) {
  let inbox = [];
  let people = new Map();
  let peerId = null;
  let history = [];
  let cursor = null;
  let more = false;
  let draft = '';
  let loading = false;
  let errorMessage = '';
  let loadError = '';
  let sendError = '';
  let generation = 0;
  let sending = false;

  function person(id) { return people.get(id) || { id, username: 'Unknown member' }; }
  function stamp(value) { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)); }
  function updateUnread() { onUnread(inbox.reduce((sum, item) => sum + Number(item.unread_count), 0)); }

  async function load() {
    const user = getUser();
    if (!user) return;
    const { data, error } = await db.rpc('text_inbox');
    if (error) {
      loadError = error.code === 'PGRST202' || error.code === 'PGRST205'
        ? 'Text needs the supabase/messaging-upgrade.sql database migration. Apply it, then reload Gather.'
        : error.message;
      throw new Error(loadError);
    }
    loadError = '';
    const ids = [...new Set([...getFriends(), ...(data || []).map((item) => item.friend_id)])];
    if (peerId) ids.push(peerId);
    let profiles = [];
    if (ids.length) {
      const result = await db.from('profiles').select('id,username,avatar_url,created_at').in('id', ids);
      if (result.error) throw result.error;
      profiles = result.data || [];
    }
    if (getUser()?.id !== user.id) return;
    inbox = data || [];
    people = new Map(profiles.map((profile) => [profile.id, profile]));
    updateUnread();
  }

  function inboxMarkup() {
    if (loadError) return `<div class="chat-empty"><p role="alert">${escapeHtml(loadError)}</p><button class="button secondary" type="button" data-inbox-retry>Try again</button></div>`;
    const rows = [...inbox];
    if (peerId && !rows.some((item) => item.friend_id === peerId)) rows.unshift({ friend_id: peerId, body: '', unread_count: 0 });
    return rows.length ? rows.map((item) => `<button type="button" class="conversation-row ${item.friend_id === peerId ? 'selected' : ''}" data-chat-peer="${item.friend_id}">${avatar(person(item.friend_id))}<span class="conversation-copy"><strong>@${escapeHtml(person(item.friend_id).username)}</strong><small>${escapeHtml(item.body || 'No messages yet')}</small></span><span class="conversation-meta">${item.created_at ? `<time datetime="${item.created_at}">${stamp(item.created_at)}</time>` : ''}${Number(item.unread_count) ? `<span class="unread-badge">${item.unread_count}</span>` : ''}</span></button>`).join('') : '<div class="chat-empty"><h2>No conversations yet</h2><p>Text a friend to start a conversation.</p><button class="button secondary" type="button" data-text-friends>Find your friends</button></div>';
  }

  function historyMarkup() {
    if (loading) return '<p class="search-empty" role="status">Loading messages...</p>';
    if (errorMessage) return `<div class="chat-empty"><p role="alert">${escapeHtml(errorMessage)}</p><button type="button" class="button secondary" data-chat-retry>Try again</button></div>`;
    return `${more ? '<button type="button" class="button quiet" data-chat-older>Older messages</button>' : ''}${history.length ? history.map((message) => `<article class="chat-bubble ${message.sender_id === getUser().id ? 'sent' : 'received'}"><p>${escapeHtml(message.body)}</p><time datetime="${message.created_at}">${stamp(message.created_at)}</time></article>`).join('') : '<p class="search-empty">No messages yet.</p>'}`;
  }

  function chatMarkup() {
    if (!peerId) return '<div class="chat-empty"><h2>Your conversations</h2><p>Select a friend to open your chat.</p></div>';
    const canSend = getFriends().includes(peerId);
    return `<header class="chat-heading"><button type="button" class="icon-button" data-chat-back title="Back to inbox" aria-label="Back to inbox">‹</button>${avatar(person(peerId))}<strong>@${escapeHtml(person(peerId).username)}</strong></header><div class="chat-history" role="log" aria-label="Message history" aria-live="polite">${historyMarkup()}</div><form class="chat-composer"><label class="visually-hidden" for="chat-body">Message</label><textarea id="chat-body" name="body" rows="2" maxlength="2000" placeholder="${canSend ? 'Message your friend...' : 'You can only send messages to current friends.'}" ${canSend ? '' : 'disabled'} required>${escapeHtml(draft)}</textarea><button type="submit" class="button primary" ${!canSend || sending ? 'disabled' : ''}>Send</button></form><p class="chat-send-error" role="alert">${escapeHtml(sendError)}</p>`;
  }

  function render() {
    return `<section class="text-view ${peerId ? 'chat-open' : ''}"><div class="page-heading"><div><p class="eyebrow">Your circle, in conversation</p><h1>Text</h1></div></div><div class="text-layout"><aside class="text-inbox" aria-label="Conversations">${inboxMarkup()}</aside><section class="text-chat" aria-label="Private conversation">${chatMarkup()}</section></div></section>`;
  }

  function wire() {
    document.querySelectorAll('[data-chat-peer]').forEach((button) => button.addEventListener('click', () => open(button.dataset.chatPeer).catch(fail)));
    document.querySelector('[data-text-friends]')?.addEventListener('click', () => navigate('friends'));
    document.querySelector('[data-inbox-retry]')?.addEventListener('click', () => load().then(() => paint()).catch(() => paint()));
    document.querySelector('[data-chat-back]')?.addEventListener('click', () => { peerId = null; generation += 1; navigate('text'); });
    document.querySelector('[data-chat-retry]')?.addEventListener('click', () => fetchHistory().catch(fail));
    document.querySelector('[data-chat-older]')?.addEventListener('click', () => fetchHistory(true).catch(fail));
    document.querySelector('.chat-composer textarea')?.addEventListener('input', (event) => { draft = event.target.value; });
    document.querySelector('.chat-composer textarea')?.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      if (!sending && event.currentTarget.value.trim()) event.currentTarget.form.requestSubmit();
    });
    document.querySelector('.chat-composer')?.addEventListener('submit', send);
    hydrateImages(document.querySelector('.text-view') || document);
    if (peerId && !loading && !errorMessage) markRead().then(load).catch(fail);
  }

  function paint(scroll = false) {
    const root = document.querySelector('.text-view');
    if (!root) return;
    const composer = root.querySelector('.chat-composer textarea');
    const focused = document.activeElement === composer;
    const selection = composer ? [composer.selectionStart, composer.selectionEnd] : null;
    const oldScroll = root.querySelector('.chat-history')?.scrollTop || 0;
    root.querySelector('.text-inbox').innerHTML = inboxMarkup();
    root.querySelector('.text-chat').innerHTML = chatMarkup();
    wire();
    const list = root.querySelector('.chat-history');
    if (list) list.scrollTop = scroll ? list.scrollHeight : oldScroll;
    if (focused && selection) {
      const input = root.querySelector('.chat-composer textarea');
      input.focus({ preventScroll: true });
      input.setSelectionRange(...selection);
    }
  }

  async function markRead() {
    if (!peerId || document.visibilityState !== 'visible' || !document.querySelector('.text-view')) return;
    const result = await db.from('messages').update({ read_at: new Date().toISOString() }).eq('sender_id', peerId).eq('recipient_id', getUser().id).is('read_at', null);
    if (result.error) throw result.error;
  }

  async function fetchHistory(older = false) {
    const user = getUser();
    const target = peerId;
    if (!target || !user) return;
    const ticket = ++generation;
    loading = !older;
    errorMessage = '';
    if (!older) paint();
    try {
      let query = db.from('messages').select('id,sender_id,recipient_id,body,created_at,read_at')
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${target}),and(sender_id.eq.${target},recipient_id.eq.${user.id})`)
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50);
      if (older && cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
      const { data, error } = await query;
      if (error) throw error;
      if (generation !== ticket || getUser()?.id !== user.id) return;
      const page = data || [];
      history = older ? [...page.reverse(), ...history] : page.reverse();
      cursor = history[0] || null;
      more = page.length === 50;
      loading = false;
      await markRead();
      await load();
      if (generation === ticket) paint(!older);
    } catch (error) {
      if (generation !== ticket) return;
      loading = false;
      errorMessage = error.message || 'Could not load messages.';
      paint();
    }
  }

  async function open(id) {
    if (!getFriends().includes(id) && !inbox.some((row) => row.friend_id === id)) throw new Error('You can only text your friends.');
    peerId = id;
    history = [];
    cursor = null;
    more = false;
    draft = '';
    sendError = '';
    loading = true;
    navigate('text');
    await fetchHistory();
  }

  async function send(event) {
    event.preventDefault();
    if (sending) return;
    const body = draft.trim();
    const target = peerId;
    if (!body || !getFriends().includes(target)) return;
    sending = true;
    sendError = '';
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    try {
      const { data, error } = await db.from('messages').insert({ sender_id: getUser().id, recipient_id: target, body }).select('id').single();
      if (error) throw error;
      draft = '';
      if (target === peerId) await fetchHistory();
      const { error: pushError } = await db.functions.invoke('notify-message', { body: { messageId: data.id } });
      if (pushError) console.warn('Message saved; browser push unavailable.', pushError);
    } catch (error) {
      sendError = error.message || 'Message was not sent. Try again.';
      const feedback = document.querySelector('.chat-send-error');
      if (feedback) feedback.textContent = sendError;
      else fail(error);
    } finally {
      sending = false;
      if (document.querySelector('.text-view')) paint();
    }
  }

  async function receive() {
    if (!getUser()) return;
    await load();
    if (peerId && document.querySelector('.text-view')) await fetchHistory();
    else paint();
  }

  function clear() {
    generation += 1;
    inbox = []; people.clear(); peerId = null; history = []; draft = ''; loading = false; errorMessage = ''; loadError = ''; sendError = ''; sending = false;
    updateUnread();
  }
  return { load, render, wire, open, receive, clear };
}