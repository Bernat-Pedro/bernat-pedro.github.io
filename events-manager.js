import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, VAPID_PUBLIC_KEY } from './supabase-config.js';

const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const toastNode = document.querySelector('#toast');
const validConfig = SUPABASE_URL.startsWith('https://') && !SUPABASE_URL.includes('YOUR_PROJECT') && !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE');
const db = validConfig ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
const state = { user: null, profile: null, tab: 'calendar', month: new Date(new Date().getFullYear(), new Date().getMonth(), 1), events: [], friends: [], requests: [], prefs: {}, filter: 'all', friendTab: 'friends', query: '', cache: new Map(), reminderTimer: null, channel: null, unreadCount: 0, seenNotifIds: new Set(), resumeCheck: null };
const categories = ['Dinner', 'Birthday', 'Outdoor', 'Celebration', 'Games', 'Travel', 'Other'];

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function toast(message, error = false) {
  toastNode.textContent = message;
  toastNode.classList.toggle('is-error', error);
  toastNode.classList.add('visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => toastNode.classList.remove('visible'), 3200);
}

function fail(error) {
  console.error(error);
  toast(error?.message || 'Something went wrong. Please try again.', true);
}

function renderLoadError(error) {
  const missingSchema = error?.code === 'PGRST205' || /schema cache|could not find the table/i.test(error?.message || '');
  const heading = missingSchema ? 'Finish database setup' : 'Couldn’t open Gather';
  const detail = missingSchema
    ? 'Supabase is connected, but Gather’s tables are missing. Run supabase/schema.sql in your project’s SQL Editor, then reload this page.'
    : 'Check your connection or Supabase setup, then try signing in again.';
  app.innerHTML = `<section class="profile-setup"><div class="setup-card"><p class="eyebrow">${missingSchema ? 'One setup step left' : 'A small connection hiccup'}</p><h1>${heading}</h1><p class="form-hint">${detail}</p><button class="button primary" type="button" data-action="retry-load">Try again <span aria-hidden="true">↻</span></button></div></section>`;
  app.querySelector('[data-action="retry-load"]').addEventListener('click', () => {
    state.user = null;
    state.profile = null;
    authScreen();
  });
}

function initials(name = '?') {
  return name.trim().slice(0, 1).toUpperCase() || '?';
}

async function assetUrl(bucket, path) {
  if (!path) return '';
  const key = `${bucket}:${path}`;
  if (state.cache.has(key)) return state.cache.get(key);
  const { data, error } = await db.storage.from(bucket).download(path);
  if (error) return '';
  const url = URL.createObjectURL(data);
  state.cache.set(key, url);
  return url;
}

function clearAssetCache() {
  for (const url of state.cache.values()) URL.revokeObjectURL(url);
  state.cache.clear();
}

function avatar(profile, size = '') {
  const name = escapeHtml(profile?.username || 'User');
  const initial = initials(profile?.username);
  const image = profile?.avatar_url ? `<img data-avatar="${escapeHtml(profile.avatar_url)}" alt="${name}'s profile picture">` : '';
  return `<span class="avatar ${size}" aria-label="${name}">${image}<span>${initial}</span></span>`;
}

async function hydrateImages(root = document) {
  await Promise.all([...root.querySelectorAll('[data-avatar]')].map(async (image) => {
    const url = await assetUrl('avatars', image.dataset.avatar);
    if (url) image.src = url;
    image.addEventListener('error', () => image.remove(), { once: true });
  }));
}

function configScreen() {
  app.innerHTML = `<section class="welcome config-welcome"><div class="welcome-mark">g.</div><p class="eyebrow">A place for your people</p><h1>Make room<br>for good plans.</h1><p class="lede">Gather your friends and family around the moments worth making.</p><div class="setup-note"><strong>Supabase setup needed</strong><p>Add your project URL and public anon key in <code>supabase-config.js</code>, then run <code>supabase/schema.sql</code> in the Supabase SQL Editor. Setup instructions are in <a href="README.md">README.md</a>.</p></div></section>`;
}

function authScreen(mode = 'login', message = '', email = '') {
  const signup = mode === 'signup';
  const confirmationSent = message.toLowerCase().includes('confirmation email sent');
  app.innerHTML = `<section class="welcome auth-layout"><div class="welcome-copy"><a class="wordmark" href="index.html">gather<span>.</span></a><p class="eyebrow">A place for your people</p><h1>Make room<br>for good plans.</h1><p class="lede">Bring your favourite people together, one plan at a time.</p><div class="welcome-art" aria-hidden="true"><span class="art-sun"></span><span class="art-circle circle-one"></span><span class="art-circle circle-two"></span><span class="art-line"></span><span class="art-caption">good things happen together</span></div></div><form class="auth-panel" id="auth-form"><p class="eyebrow">${signup ? 'Your corner of Gather' : 'Welcome back'}</p><h2>${signup ? 'Create your account' : 'Sign in'}</h2><p class="form-hint">${signup ? 'Use an email and password to get started.' : 'Pick up where your people left off.'}</p><p class="inline-error ${confirmationSent ? 'is-success' : ''}" id="auth-error" role="status" ${message ? '' : 'hidden'}>${escapeHtml(message)}</p><button class="text-button resend-link" type="button" data-action="resend-confirmation" ${message ? '' : 'hidden'}>Resend Confirmation Email</button><label>Email<input name="email" type="email" autocomplete="email" value="${escapeHtml(email)}" required maxlength="254"></label><label>Password<input name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" minlength="8" required></label><button class="button primary wide" type="submit">${signup ? 'Create account' : 'Sign in'}<span aria-hidden="true">→</span></button><p class="switch-auth">${signup ? 'Already have an account?' : 'New to Gather?'} <button class="text-button" type="button" data-action="auth-switch">${signup ? 'Sign in' : 'Create an account'}</button></p><p class="privacy-note">Your email stays private. Friends see your username, never your login details.</p></form></section>`;
  app.querySelector('[data-action="auth-switch"]').addEventListener('click', () => authScreen(signup ? 'login' : 'signup'));
  app.querySelector('[data-action="resend-confirmation"]').addEventListener('click', async (event) => {
    const form = app.querySelector('#auth-form');
    const email = form.elements.email.value.trim();
    if (!email) {
      form.elements.email.focus();
      return form.elements.email.reportValidity();
    }
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const { error } = await db.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${location.origin}${location.pathname}` } });
      if (error) throw error;
      const feedback = app.querySelector('#auth-error');
      feedback.hidden = false;
      feedback.classList.add('is-success');
      feedback.textContent = 'Confirmation email sent. Check your inbox and spam folder.';
    } catch (error) {
      const feedback = app.querySelector('#auth-error');
      feedback.hidden = false;
      feedback.classList.remove('is-success');
      feedback.textContent = error.message || 'Could not resend the email. Please try again later.';
    } finally {
      button.disabled = false;
    }
  });
  app.querySelector('#auth-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const credentials = { email: String(form.get('email')).trim(), password: String(form.get('password')) };
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const { data, error } = signup
        ? await db.auth.signUp({ ...credentials, options: { emailRedirectTo: `${location.origin}${location.pathname}` } })
        : await db.auth.signInWithPassword(credentials);
      if (error) throw error;
      if (signup && !data.session) authScreen('login', 'Confirmation email sent. Check your inbox.', credentials.email);
    } catch (error) {
      button.disabled = false;
      if (error.code === 'email_not_confirmed' || /email not confirmed/i.test(error.message || '')) {
        const feedback = app.querySelector('#auth-error');
        feedback.hidden = false;
        feedback.classList.remove('is-success');
        feedback.textContent = 'Please confirm your email before signing in. Check your inbox or resend the confirmation.';
        app.querySelector('[data-action="resend-confirmation"]').hidden = false;
      } else {
        fail(error);
      }
    }
  });
}

function profileSetup() {
  app.innerHTML = `<section class="profile-setup"><a class="wordmark" href="index.html">gather<span>.</span></a><div class="setup-card"><p class="eyebrow">First things first</p><h1>Create your profile</h1><p class="form-hint">Choose a username your friends will recognize.</p><form id="profile-form"><label class="upload-avatar" for="avatar-file"><span class="avatar avatar-xl" id="avatar-preview"><span>?</span></span><span class="upload-copy"><strong>Add a profile picture</strong><small>JPG, PNG, WebP or GIF · up to 5 MB</small></span><input id="avatar-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label><label>Username<input name="username" autocomplete="username" minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" required placeholder="e.g. alexrivera"><small>3–24 letters, numbers or underscores. Unique across Gather.</small></label><button class="button primary wide" type="submit">Create profile <span aria-hidden="true">→</span></button></form></div></section>`;
  let photo;
  const input = app.querySelector('#avatar-file');
  input.addEventListener('change', () => {
    photo = input.files[0];
    if (!photo) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(photo.type) || photo.size > 5 * 1024 * 1024) {
      photo = null;
      input.value = '';
      return toast('Choose a JPG, PNG, WebP or GIF under 5 MB.', true);
    }
    const preview = app.querySelector('#avatar-preview');
    preview.innerHTML = `<img src="${URL.createObjectURL(photo)}" alt="Profile picture preview">`;
  });
  app.querySelector('#profile-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    const username = new FormData(event.currentTarget).get('username').trim();
    try {
      let avatarPath = null;
      if (photo) {
        avatarPath = `${state.user.id}/${crypto.randomUUID()}`;
        const { error } = await db.storage.from('avatars').upload(avatarPath, photo, { contentType: photo.type, upsert: false });
        if (error) throw error;
      }
      const { error } = await db.from('profiles').insert({ id: state.user.id, username, avatar_url: avatarPath });
      if (error?.code === '23505') throw new Error('That username is already taken. Try another one.');
      if (error) throw error;
      await ensurePreferences();
      await loadApplication();
    } catch (error) {
      button.disabled = false;
      fail(error);
    }
  });
}

async function ensurePreferences() {
  const { error } = await db.from('notification_preferences').upsert({ user_id: state.user.id }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (error) throw error;
}

async function loadApplication() {
  const [profileResult, preferencesResult, friendshipResult, requestResult, eventResult, unreadResult] = await Promise.all([
    db.from('profiles').select('id,username,avatar_url,created_at').eq('id', state.user.id).maybeSingle(),
    db.from('notification_preferences').select('*').eq('user_id', state.user.id).maybeSingle(),
    db.from('friendships').select('user_low,user_high'),
    db.from('friend_requests').select('id,requester_id,recipient_id,status,created_at').or(`requester_id.eq.${state.user.id},recipient_id.eq.${state.user.id}`).eq('status', 'pending').order('created_at', { ascending: false }),
    db.from('events').select('id,creator_id,name,category,event_date,starts_at,ends_at,all_day,description,location,photo_path,created_at').order('event_date'),
    db.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)
  ]);
  for (const result of [profileResult, preferencesResult, friendshipResult, requestResult, eventResult, unreadResult]) if (result.error) throw result.error;
  state.profile = profileResult.data;
  if (!state.profile) return profileSetup();
  state.prefs = preferencesResult.data || {};
  state.friends = friendshipResult.data || [];
  state.requests = requestResult.data || [];
  state.events = eventResult.data || [];
  state.unreadCount = unreadResult.count || 0;
  applyTheme(state.prefs.theme || 'light');
  renderApp();
  await hydrateImages(app);
  setupRealtime();
  startReminders();
  handleDeepLink();
}

function handleDeepLink() {
  const url = new URL(location.href);
  const eventId = url.searchParams.get('event');
  const showRequests = url.searchParams.get('requests') === '1';
  if (!eventId && !showRequests) return;
  url.searchParams.delete('event');
  url.searchParams.delete('requests');
  history.replaceState({}, '', url);
  if (eventId) showEvent(eventId);
  else { state.tab = 'friends'; state.friendTab = 'requests'; renderApp(); }
}

function friendIds() {
  return state.friends.map((friend) => friend.user_low === state.user.id ? friend.user_high : friend.user_low);
}

function visibleEvents() {
  const friends = new Set(friendIds());
  return state.events.filter((event) => state.filter === 'all' ? true : event.creator_id !== state.user.id && friends.has(event.creator_id));
}

function monthDays(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = [];
  for (let index = 0; index < mondayOffset; index += 1) cells.push(null);
  for (let date = 1; date <= count; date += 1) cells.push(date);
  while (cells.length % 7) cells.push(null);
  return cells;
}

function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function eventTime(event) {
  if (event.all_day || !event.starts_at) return 'All day';
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(event.starts_at));
}

function renderCalendar() {
  const monthEvents = visibleEvents();
  const year = state.month.getFullYear();
  const month = state.month.getMonth();
  const today = dateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const cells = monthDays(state.month).map((date) => {
    if (!date) return '<div class="day-cell empty" aria-hidden="true"></div>';
    const key = dateKey(year, month, date);
    const events = monthEvents.filter((item) => item.event_date === key);
    return `<div class="day-cell ${key === today ? 'today' : ''}" data-date="${key}"><span class="day-number">${date}</span><div class="day-events">${events.slice(0, 3).map((item) => `<button class="calendar-event" type="button" data-event="${item.id}" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</button>`).join('')}${events.length > 3 ? `<span class="more-events">+${events.length - 3} more</span>` : ''}</div></div>`;
  }).join('');
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const hasEvents = monthEvents.some((event) => event.event_date.startsWith(monthPrefix));
  return `<section class="calendar-panel"><div class="calendar-top"><div><p class="eyebrow">The good stuff</p><h2>Calendar</h2></div><div class="month-controls"><button class="icon-button" type="button" data-action="month-prev" aria-label="Previous month">‹</button><button class="today-button" type="button" data-action="today">Today</button><button class="icon-button" type="button" data-action="month-next" aria-label="Next month">›</button></div></div><div class="month-label"><h3>${new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(state.month)}</h3><div class="segmented" role="group" aria-label="Event visibility"><button type="button" data-filter="friends" class="${state.filter === 'friends' ? 'selected' : ''}">Friends</button><button type="button" data-filter="all" class="${state.filter === 'all' ? 'selected' : ''}">All</button></div></div><div class="calendar-grid"><div class="weekday">Mon</div><div class="weekday">Tue</div><div class="weekday">Wed</div><div class="weekday">Thu</div><div class="weekday">Fri</div><div class="weekday">Sat</div><div class="weekday">Sun</div>${cells}</div>${hasEvents ? '' : '<p class="calendar-empty">No plans this month yet. Start with one in the planner.</p>'}</section>`;
}

function renderPlanner() {
  return `<section class="planner-panel"><div class="panel-heading"><p class="eyebrow">Make it happen</p><h2>Plan something</h2></div><form id="event-form" class="stack-form"><label>Event name<input name="name" required maxlength="100" placeholder="Sunday supper"></label><label>Category<select name="category" required>${categories.map((category) => `<option>${category}</option>`).join('')}</select></label><label>Date<input name="event_date" type="date" required value="${dateKey(state.month.getFullYear(), state.month.getMonth(), Math.min(new Date().getDate(), new Date(state.month.getFullYear(), state.month.getMonth() + 1, 0).getDate()))}"></label><label class="switch-row"><span><strong>All day</strong><small>Skip the clock for this one</small></span><input type="checkbox" name="all_day" checked><span class="switch-ui"></span></label><div class="time-fields" hidden><label>From<input name="start_time" type="time"></label><label>To<input name="end_time" type="time"></label></div><label>Description <span class="optional">Optional</span><textarea name="description" rows="3" maxlength="1000" placeholder="A few details for your guests"></textarea></label><label>Location <span class="optional">Optional</span><input name="location" maxlength="200" placeholder="Where to meet"></label><label class="photo-field">Event photo <span class="optional">Optional</span><input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif"><span class="photo-preview" id="event-photo-preview" hidden></span><small>Image up to 5 MB</small></label><button class="button primary wide" type="submit">Create event <span aria-hidden="true">↗</span></button></form></section>`;
}

function renderApp() {
  const nav = [['calendar', 'Calendar'], ['friends', 'Friends'], ['settings', 'Settings']];
  app.innerHTML = `<div class="app-shell"><aside class="sidebar"><a class="wordmark" href="index.html">gather<span>.</span></a><p class="side-label">YOUR SPACE</p><nav class="side-nav" aria-label="Main navigation">${nav.map(([key, title]) => `<button type="button" data-tab="${key}" class="${state.tab === key ? 'active' : ''}"><span class="nav-dot ${key}"></span>${title}${key === 'friends' && state.requests.some((request) => request.recipient_id === state.user.id) ? '<span class="nav-count">•</span>' : ''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="profile-chip">${avatar(state.profile)}<span><strong>${escapeHtml(state.profile.username)}</strong><small>Your profile</small></span><button type="button" class="icon-button tiny" data-action="profile" aria-label="View profile">···</button></div><a class="site-link" href="index.html">← Back to Bernat's site</a></div></aside><div class="main-column"><header class="topbar"><span class="topbar-date">${new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</span><div class="topbar-actions"><button class="icon-button" type="button" data-action="notifications" aria-label="Notifications" title="Notifications">♧<span class="notification-dot" ${state.unreadCount ? '' : 'hidden'}></span></button>${avatar(state.profile, 'avatar-small')}</div></header><main class="content">${state.tab === 'calendar' ? `<div class="calendar-layout">${renderCalendar()}${renderPlanner()}</div>` : state.tab === 'friends' ? renderFriends() : renderSettings()}</main></div></div>`;
  wireSharedEvents();
  if (state.tab === 'calendar') wireCalendar();
  if (state.tab === 'friends') wireFriends();
  if (state.tab === 'settings') wireSettings();
  hydrateImages(app);
}

function renderFriends() {
  const pendingIncoming = state.requests.filter((request) => request.recipient_id === state.user.id);
  const pendingOutgoing = state.requests.filter((request) => request.requester_id === state.user.id);
  return `<section class="friends-view"><div class="page-heading"><div><p class="eyebrow">Your circle</p><h1>Friends</h1></div><button class="icon-button search-button" type="button" data-action="search" aria-label="Find friends" title="Find friends">⌕</button></div><div class="tabs"><button type="button" data-friend-tab="friends" class="${state.friendTab === 'friends' ? 'active' : ''}">Your friends <span>${friendIds().length}</span></button><button type="button" data-friend-tab="requests" class="${state.friendTab === 'requests' ? 'active' : ''}">Friend requests <span>${pendingIncoming.length}</span></button></div>${state.friendTab === 'friends' ? renderFriendList() : renderRequests(pendingIncoming, pendingOutgoing)}</section>`;
}

function renderFriendList() {
  const ids = friendIds();
  if (!ids.length) return '<div class="empty-state"><span class="empty-art">◎</span><h2>Your circle starts here</h2><p>You don’t have any friends yet. Find your people by username.</p><button class="button secondary" type="button" data-action="search">Find friends <span aria-hidden="true">⌕</span></button></div>';
  return `<div class="people-list">${ids.map((id) => `<article class="person-row" data-person-id="${id}"><span class="person-avatar" data-person-avatar="${id}"></span><span class="person-info" data-person-info="${id}"><strong>Loading profile…</strong><small>Gather friend</small></span><button class="button quiet" type="button" data-remove-friend="${id}">Remove</button></article>`).join('')}</div>`;
}

function renderRequests(incoming, outgoing) {
  if (!incoming.length && !outgoing.length) return '<div class="empty-state compact-empty"><span class="empty-art">↔</span><h2>No requests right now</h2><p>When someone wants to connect, you’ll find it here.</p></div>';
  return `<div class="people-list">${incoming.map((request) => `<article class="person-row" data-request-id="${request.id}" data-person-id="${request.requester_id}"><span class="person-avatar" data-person-avatar="${request.requester_id}"></span><span class="person-info" data-person-info="${request.requester_id}"><strong>Loading profile…</strong><small>Sent you a friend request</small></span><div class="request-actions"><button class="button primary small-button" type="button" data-request-action="accept" data-id="${request.id}">Accept</button><button class="button quiet small-button" type="button" data-request-action="decline" data-id="${request.id}">Decline</button></div></article>`).join('')}${outgoing.map((request) => `<article class="person-row" data-person-id="${request.recipient_id}"><span class="person-avatar" data-person-avatar="${request.recipient_id}"></span><span class="person-info" data-person-info="${request.recipient_id}"><strong>Loading profile…</strong><small>Request sent</small></span><span class="pending-label">Pending</span></article>`).join('')}</div>`;
}

function renderSettings() {
  const preferences = state.prefs;
  return `<section class="settings-view"><div class="page-heading"><div><p class="eyebrow">Make it yours</p><h1>Settings</h1></div></div><div class="settings-grid"><section class="settings-section"><div class="panel-heading"><p class="eyebrow">Appearance</p><h2>A familiar feel</h2></div><div class="setting-row"><span><strong>Theme</strong><small>Saved to your account</small></span><div class="segmented" role="group" aria-label="Theme"><button type="button" data-theme="light" class="${preferences.theme !== 'dark' ? 'selected' : ''}">Light</button><button type="button" data-theme="dark" class="${preferences.theme === 'dark' ? 'selected' : ''}">Dark</button></div></div></section><section class="settings-section"><div class="panel-heading"><p class="eyebrow">Reminders</p><h2>Stay in the loop</h2></div><p class="form-hint">Timed-event reminders work in-app. Background push requires a deployed Supabase function and scheduled job; see README.md.</p>${toggleSetting('reminders_enabled', 'Event reminders', 'Get a nudge about your plans', preferences.reminders_enabled !== false)}${toggleSetting('reminder_15_enabled', '15 minutes before', 'A little time to get ready', preferences.reminder_15_enabled !== false)}${toggleSetting('reminder_start_enabled', 'When an event starts', 'Know when it’s time to go', preferences.reminder_start_enabled !== false)}${toggleSetting('friend_request_notifications', 'Friend requests', 'A heads-up when someone reaches out', preferences.friend_request_notifications !== false)}${toggleSetting('notification_sound', 'Notification sound', 'Play a gentle sound with reminders', Boolean(preferences.notification_sound))}<button class="button secondary permission-button" type="button" data-action="permission">Enable browser notifications</button></section><section class="settings-section account-section"><div class="panel-heading"><p class="eyebrow">Your account</p><h2>Account details</h2></div><div class="account-profile">${avatar(state.profile, 'avatar-large')}<div><strong>@${escapeHtml(state.profile.username)}</strong><small>Account created ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(state.profile.created_at))}</small></div></div><form id="username-form" class="username-form"><label>Change username<input name="username" value="${escapeHtml(state.profile.username)}" minlength="3" maxlength="24" pattern="[A-Za-z0-9_]{3,24}" required></label><button class="button secondary" type="submit">Save username</button></form><label class="change-photo">Change profile picture<input name="profile-photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label><button class="button danger" type="button" data-action="delete-account">Delete account</button></section></div></section>`;
}

function toggleSetting(key, title, detail, checked) {
  return `<label class="setting-row toggle-setting"><span><strong>${title}</strong><small>${detail}</small></span><input type="checkbox" data-pref="${key}" ${checked ? 'checked' : ''}><span class="switch-ui"></span></label>`;
}

function wireSharedEvents() {
  app.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => {
    state.tab = button.dataset.tab;
    renderApp();
  }));
  app.querySelector('[data-action="profile"]')?.addEventListener('click', () => showProfile(state.profile));
  app.querySelector('[data-action="notifications"]')?.addEventListener('click', showNotifications);
  app.querySelector('[data-action="delete-account"]')?.addEventListener('click', confirmDeleteAccount);
}

function wireCalendar() {
  app.querySelector('[data-action="month-prev"]').addEventListener('click', () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1); renderApp(); });
  app.querySelector('[data-action="month-next"]').addEventListener('click', () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1); renderApp(); });
  app.querySelector('[data-action="today"]').addEventListener('click', () => { state.month = new Date(new Date().getFullYear(), new Date().getMonth(), 1); renderApp(); });
  app.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => { state.filter = button.dataset.filter; renderApp(); }));
  app.querySelectorAll('[data-event]').forEach((button) => button.addEventListener('click', () => showEvent(button.dataset.event)));
  const allDay = app.querySelector('[name="all_day"]');
  const timeFields = app.querySelector('.time-fields');
  allDay.addEventListener('change', () => { timeFields.hidden = allDay.checked; timeFields.querySelectorAll('input').forEach((input) => { input.required = !allDay.checked; }); });
  app.querySelector('[name="photo"]').addEventListener('change', (event) => {
    const file = event.target.files[0];
    const preview = app.querySelector('#event-photo-preview');
    if (!file) { preview.hidden = true; preview.replaceChildren(); return; }
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type) || file.size > 5 * 1024 * 1024) {
      event.target.value = '';
      preview.hidden = true;
      preview.replaceChildren();
      return toast('Choose an image under 5 MB.', true);
    }
    const image = document.createElement('img');
    image.src = URL.createObjectURL(file);
    image.alt = 'Event photo preview';
    preview.replaceChildren(image);
    preview.hidden = false;
  });
  app.querySelector('#event-form').addEventListener('submit', createEvent);
}

async function createEvent(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = new FormData(form);
  const allDay = values.has('all_day');
  const date = String(values.get('event_date'));
  const startTime = String(values.get('start_time') || '');
  const endTime = String(values.get('end_time') || '');
  if (!allDay && (!startTime || !endTime || endTime <= startTime)) return toast('The end time must be later than the start time.', true);
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    let photoPath = null;
    const photo = values.get('photo');
    if (photo?.size) {
      if (!/^image\/(jpeg|png|webp|gif)$/.test(photo.type) || photo.size > 5 * 1024 * 1024) throw new Error('Choose an image under 5 MB.');
      photoPath = `${state.user.id}/${crypto.randomUUID()}`;
      const { error } = await db.storage.from('event-photos').upload(photoPath, photo, { contentType: photo.type });
      if (error) throw error;
    }
    const startsAt = allDay ? new Date(`${date}T00:00`).toISOString() : new Date(`${date}T${startTime}`).toISOString();
    const endsAt = allDay ? null : new Date(`${date}T${endTime}`).toISOString();
    const record = { creator_id: state.user.id, name: String(values.get('name')).trim(), category: values.get('category'), event_date: date, starts_at: startsAt, ends_at: endsAt, all_day: allDay, description: String(values.get('description') || '').trim() || null, location: String(values.get('location') || '').trim() || null, photo_path: photoPath };
    const { error } = await db.from('events').insert(record);
    if (error) throw error;
    await refreshData();
    toast('Your event is on the calendar.');
  } catch (error) { fail(error); }
  finally { button.disabled = false; }
}

async function refreshData() {
  const [events, friends, requests, preferences, unread] = await Promise.all([
    db.from('events').select('id,creator_id,name,category,event_date,starts_at,ends_at,all_day,description,location,photo_path,created_at').order('event_date'),
    db.from('friendships').select('user_low,user_high'),
    db.from('friend_requests').select('id,requester_id,recipient_id,status,created_at').or(`requester_id.eq.${state.user.id},recipient_id.eq.${state.user.id}`).eq('status', 'pending'),
    db.from('notification_preferences').select('*').eq('user_id', state.user.id).maybeSingle(),
    db.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)
  ]);
  for (const result of [events, friends, requests, preferences, unread]) if (result.error) throw result.error;
  state.events = events.data || [];
  state.friends = friends.data || [];
  state.requests = requests.data || [];
  state.prefs = preferences.data || {};
  state.unreadCount = unread.count || 0;
  renderApp();
  await hydrateImages(app);
}

async function wireFriends() {
  app.querySelectorAll('[data-friend-tab]').forEach((button) => button.addEventListener('click', () => { state.friendTab = button.dataset.friendTab; renderApp(); }));
  app.querySelector('[data-action="search"]')?.addEventListener('click', showSearch);
  const ids = [...new Set([...friendIds(), ...state.requests.map((request) => request.requester_id === state.user.id ? request.recipient_id : request.requester_id)])];
  await loadPeople(ids);
  app.querySelectorAll('[data-remove-friend]').forEach((button) => button.addEventListener('click', async () => {
    if (!confirm('Remove this friend? They will no longer see your friend-only events.')) return;
    try {
      const { error } = await db.rpc('remove_friend', { friend_id: button.dataset.removeFriend });
      if (error) throw error;
      await refreshData();
      toast('Friend removed.');
    } catch (error) { fail(error); }
  }));
  app.querySelectorAll('[data-request-action]').forEach((button) => button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const { error } = await db.rpc('respond_friend_request', { request_id: button.dataset.id, accept_request: button.dataset.requestAction === 'accept' });
      if (error) throw error;
      await refreshData();
      toast(button.dataset.requestAction === 'accept' ? 'You’re friends now.' : 'Request declined.');
    } catch (error) { button.disabled = false; fail(error); }
  }));
  app.querySelectorAll('[data-person-id]').forEach((row) => row.querySelector('.person-info')?.addEventListener('click', () => openPerson(row.dataset.personId)));
}

async function loadPeople(ids) {
  if (!ids.length) return;
  const { data, error } = await db.from('profiles').select('id,username,avatar_url,created_at').in('id', ids);
  if (error) return fail(error);
  for (const person of data || []) {
    const avatarSlot = app.querySelector(`[data-person-avatar="${person.id}"]`);
    const info = app.querySelector(`[data-person-info="${person.id}"]`);
    if (avatarSlot) { avatarSlot.innerHTML = avatar(person); await hydrateImages(avatarSlot); }
    if (info) info.innerHTML = `<strong>@${escapeHtml(person.username)}</strong><small>Gather friend</small>`;
  }
}

function renderSearchResults(container, people, currentRequests) {
  if (!people.length) { container.innerHTML = '<p class="search-empty">No profiles found. Check the spelling and try again.</p>'; return; }
  container.innerHTML = people.map((person) => {
    const isFriend = friendIds().includes(person.id);
    const request = currentRequests.find((item) => item.requester_id === person.id || item.recipient_id === person.id);
    const label = isFriend ? 'Already friends' : request ? 'Request pending' : 'Add friend';
    return `<article class="person-row search-result"><span class="person-avatar">${avatar(person)}</span><button class="person-info person-open" type="button" data-person-open="${person.id}"><strong>@${escapeHtml(person.username)}</strong><small>${isFriend ? 'In your circle' : 'Gather member'}</small></button><button class="button ${isFriend || request ? 'quiet' : 'secondary'} small-button" type="button" data-send-request="${person.id}" ${isFriend || request ? 'disabled' : ''}>${label}</button></article>`;
  }).join('');
  hydrateImages(container);
  container.querySelectorAll('[data-send-request]').forEach((button) => button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await sendFriendRequest(button.dataset.sendRequest);
      toast('Friend request sent.');
      showSearch(state.query);
    } catch (error) { button.disabled = false; fail(error); }
  }));
  container.querySelectorAll('[data-person-open]').forEach((button) => button.addEventListener('click', () => openPerson(button.dataset.personOpen)));
}

async function showSearch(query = '') {
  state.query = query;
  modal.innerHTML = `<div class="modal-heading"><div><p class="eyebrow">Find your people</p><h2>Search by username</h2></div><button class="icon-button" type="button" data-close aria-label="Close">×</button></div><form id="search-form" class="search-form"><span aria-hidden="true">⌕</span><input name="query" value="${escapeHtml(query)}" placeholder="Try a username…" minlength="1" maxlength="24" autocomplete="off"><button type="submit" class="button secondary">Search</button></form><div class="search-results" id="search-results"><p class="search-empty">Search Gather members by username.</p></div>`;
  modal.showModal();
  modal.querySelector('[data-close]').addEventListener('click', () => modal.close());
  modal.querySelector('#search-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const term = new FormData(event.currentTarget).get('query').trim().replace(/^@/, '');
    state.query = term;
    const results = modal.querySelector('#search-results');
    results.innerHTML = '<p class="search-empty">Looking around…</p>';
    if (!term) return;
    const [profiles, requests] = await Promise.all([db.from('profiles').select('id,username,avatar_url,created_at').ilike('username', `%${term}%`).neq('id', state.user.id).limit(20), db.from('friend_requests').select('id,requester_id,recipient_id').eq('status', 'pending').or(`requester_id.eq.${state.user.id},recipient_id.eq.${state.user.id}`)]);
    if (profiles.error) return fail(profiles.error);
    if (requests.error) return fail(requests.error);
    renderSearchResults(results, profiles.data || [], requests.data || []);
  });
  if (query) modal.querySelector('#search-form').requestSubmit();
}

async function getPerson(id) {
  const { data, error } = await db.from('profiles').select('id,username,avatar_url,created_at').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function sendFriendRequest(recipientId) {
  const { data: requestId, error } = await db.rpc('send_friend_request', { recipient_id: recipientId });
  if (error) throw error;
  const { error: pushError } = await db.functions.invoke('notify-friend-request', { body: { requestId } });
  if (pushError) console.warn('Push delivery unavailable; the in-app request notification was saved.', pushError);
}

async function openPerson(id) {
  try { showProfile(await getPerson(id)); } catch (error) { fail(error); }
}

async function showProfile(person) {
  if (!person) return;
  const own = person.id === state.user.id;
  const isFriend = friendIds().includes(person.id);
  const pending = state.requests.some((request) => (request.requester_id === person.id && request.recipient_id === state.user.id) || (request.requester_id === state.user.id && request.recipient_id === person.id));
  modal.innerHTML = `<div class="modal-heading"><span></span><button class="icon-button" type="button" data-close aria-label="Close">×</button></div><div class="profile-modal">${avatar(person, 'avatar-xl')}<p class="eyebrow">Gather member</p><h2>@${escapeHtml(person.username)}</h2><p>Member since ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(person.created_at))}</p>${own ? '<button class="button secondary" type="button" data-edit-profile>Manage your profile</button>' : isFriend ? '<span class="friend-badge">In your circle</span>' : pending ? '<span class="friend-badge">Request pending</span>' : `<button class="button primary" type="button" data-send-request="${person.id}">Send friend request <span aria-hidden="true">↗</span></button>`}</div>`;
  modal.showModal();
  await hydrateImages(modal);
  modal.querySelector('[data-close]').addEventListener('click', () => modal.close());
  modal.querySelector('[data-edit-profile]')?.addEventListener('click', () => { modal.close(); state.tab = 'settings'; renderApp(); });
  modal.querySelector('[data-send-request]')?.addEventListener('click', async (event) => {
    event.currentTarget.disabled = true;
    try { await sendFriendRequest(person.id); toast('Friend request sent.'); modal.close(); await refreshData(); }
    catch (error) { event.currentTarget.disabled = false; fail(error); }
  });
}

async function showEvent(id) {
  const event = state.events.find((item) => item.id === id);
  if (!event) return;
  try {
    const creator = event.creator_id === state.user.id ? state.profile : await getPerson(event.creator_id);
    const own = event.creator_id === state.user.id;
    const imageUrl = event.photo_path ? await assetUrl('event-photos', event.photo_path) : '';
    const photo = imageUrl ? `<img class="event-photo" src="${imageUrl}" alt="Photo for ${escapeHtml(event.name)}">` : '';
    modal.innerHTML = `<div class="modal-heading"><span></span><button class="icon-button" type="button" data-close aria-label="Close">×</button></div>${photo}<div class="event-detail"><span class="category-label">${escapeHtml(event.category)}</span><h2>${escapeHtml(event.name)}</h2><p class="event-detail-time">${new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(new Date(`${event.event_date}T12:00:00`))} · ${eventTime(event)}</p>${event.location ? `<p class="detail-line"><strong>Where</strong>${escapeHtml(event.location)}</p>` : ''}${event.description ? `<p class="detail-description">${escapeHtml(event.description)}</p>` : ''}<div class="event-host">${avatar(creator)}<span><small>Put together by</small><strong>@${escapeHtml(creator.username)}</strong></span>${!own && !friendIds().includes(creator.id) ? `<button class="button secondary small-button" type="button" data-send-request="${creator.id}">Add friend</button>` : ''}</div>${own ? '<div class="event-actions"><button class="button secondary" type="button" data-edit-event>Edit event</button><button class="button danger" type="button" data-delete-event>Delete event</button></div>' : ''}</div>`;
    modal.showModal();
    modal.querySelector('[data-close]').addEventListener('click', () => modal.close());
    await hydrateImages(modal);
    modal.querySelector('[data-send-request]')?.addEventListener('click', async (action) => {
      action.currentTarget.disabled = true;
      try { await sendFriendRequest(creator.id); toast('Friend request sent.'); modal.close(); await refreshData(); } catch (error) { action.currentTarget.disabled = false; fail(error); }
    });
    modal.querySelector('[data-delete-event]')?.addEventListener('click', async () => {
      if (!confirm(`Delete “${event.name}”?`)) return;
      const { error } = await db.from('events').delete().eq('id', event.id);
      if (error) return fail(error);
      modal.close(); await refreshData(); toast('Event deleted.');
    });
    modal.querySelector('[data-edit-event]')?.addEventListener('click', () => editEvent(event));
  } catch (error) { fail(error); }
}

function editEvent(event) {
  modal.innerHTML = `<div class="modal-heading"><div><p class="eyebrow">Your plans</p><h2>Edit event</h2></div><button class="icon-button" type="button" data-close aria-label="Close">×</button></div><form id="edit-event-form" class="stack-form"><label>Event name<input name="name" value="${escapeHtml(event.name)}" required maxlength="100"></label><label>Category<select name="category">${categories.map((category) => `<option ${category === event.category ? 'selected' : ''}>${category}</option>`).join('')}</select></label><label>Date<input name="event_date" type="date" value="${event.event_date}" required></label><label class="switch-row"><span><strong>All day</strong></span><input type="checkbox" name="all_day" ${event.all_day ? 'checked' : ''}><span class="switch-ui"></span></label><div class="time-fields" ${event.all_day ? 'hidden' : ''}><label>From<input name="start_time" type="time" value="${event.starts_at ? new Date(event.starts_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : ''}" ${event.all_day ? '' : 'required'}></label><label>To<input name="end_time" type="time" value="${event.ends_at ? new Date(event.ends_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : ''}" ${event.all_day ? '' : 'required'}></label></div><label>Description<textarea name="description" rows="3" maxlength="1000">${escapeHtml(event.description || '')}</textarea></label><label>Location<input name="location" maxlength="200" value="${escapeHtml(event.location || '')}"></label><button class="button primary wide" type="submit">Save changes</button></form>`;
  modal.showModal();
  modal.querySelector('[data-close]').addEventListener('click', () => modal.close());
  const allDay = modal.querySelector('[name="all_day"]');
  allDay.addEventListener('change', () => { modal.querySelector('.time-fields').hidden = allDay.checked; modal.querySelectorAll('.time-fields input').forEach((input) => { input.required = !allDay.checked; }); });
  modal.querySelector('#edit-event-form').addEventListener('submit', async (action) => {
    action.preventDefault();
    const values = new FormData(action.currentTarget);
    const allDayValue = values.has('all_day');
    const date = String(values.get('event_date'));
    const startTime = String(values.get('start_time') || '');
    const endTime = String(values.get('end_time') || '');
    if (!allDayValue && (!startTime || !endTime || endTime <= startTime)) return toast('The end time must be later than the start time.', true);
    const { error } = await db.from('events').update({ name: String(values.get('name')).trim(), category: values.get('category'), event_date: date, starts_at: allDayValue ? new Date(`${date}T00:00`).toISOString() : new Date(`${date}T${startTime}`).toISOString(), ends_at: allDayValue ? null : new Date(`${date}T${endTime}`).toISOString(), all_day: allDayValue, description: String(values.get('description') || '').trim() || null, location: String(values.get('location') || '').trim() || null }).eq('id', event.id);
    if (error) return fail(error);
    modal.close(); await refreshData(); toast('Event updated.');
  });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : 'light';
}

function wireSettings() {
  const deleteButton = app.querySelector('[data-action="delete-account"]');
  if (deleteButton) {
    const signOutButton = document.createElement('button');
    signOutButton.type = 'button';
    signOutButton.className = 'button secondary sign-out-button';
    signOutButton.textContent = 'Sign out';
    deleteButton.before(signOutButton);
    signOutButton.addEventListener('click', async () => {
      signOutButton.disabled = true;
      try {
        const { error } = await db.auth.signOut({ scope: 'local' });
        if (error) throw error;
        clearInterval(state.reminderTimer);
        await state.channel?.unsubscribe();
        clearAssetCache();
        state.user = null;
        state.profile = null;
        state.events = [];
        state.friends = [];
        state.requests = [];
        state.prefs = {};
        state.channel = null;
        authScreen();
      } catch (error) {
        signOutButton.disabled = false;
        fail(error);
      }
    });
  }
  app.querySelectorAll('[data-theme]').forEach((button) => button.addEventListener('click', async () => {
    const theme = button.dataset.theme;
    try {
      const { error } = await db.from('notification_preferences').upsert({ user_id: state.user.id, theme }, { onConflict: 'user_id' });
      if (error) throw error;
      state.prefs.theme = theme;
      applyTheme(theme);
      renderApp();
      toast('Theme saved.');
    } catch (error) { fail(error); }
  }));
  app.querySelectorAll('[data-pref]').forEach((input) => input.addEventListener('change', async () => {
    const key = input.dataset.pref;
    const { error } = await db.from('notification_preferences').upsert({ user_id: state.user.id, [key]: input.checked }, { onConflict: 'user_id' });
    if (error) { input.checked = !input.checked; return fail(error); }
    state.prefs[key] = input.checked;
    toast('Notification preference saved.');
  }));
  app.querySelector('[data-action="permission"]').addEventListener('click', async () => {
    if (!('Notification' in window)) return toast('Browser notifications are not supported here.', true);
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return toast('Browser notifications were not enabled.', true);
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return toast('Background push is not supported in this browser. In-app reminders still work.');
    if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY.includes('YOUR_VAPID')) return toast('Add the VAPID public key to supabase-config.js to enable background push.', true);
    try {
      const registration = await navigator.serviceWorker.register('./service-worker.js');
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeBase64Url(VAPID_PUBLIC_KEY) });
      const { error } = await db.from('push_subscriptions').upsert({ user_id: state.user.id, endpoint: subscription.endpoint, subscription: subscription.toJSON() }, { onConflict: 'endpoint' });
      if (error) throw error;
      toast('Background browser notifications enabled.');
    } catch (error) { fail(error); }
  });
  app.querySelector('#username-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = String(new FormData(event.currentTarget).get('username')).trim();
    const { data, error } = await db.from('profiles').update({ username }).eq('id', state.user.id).select('id,username,avatar_url,created_at').maybeSingle();
    if (error?.code === '23505') return fail(new Error('That username is already taken.'));
    if (error) return fail(error);
    state.profile = data;
    renderApp();
    toast('Username updated.');
  });
  app.querySelector('[name="profile-photo"]').addEventListener('change', async (event) => {
    const photo = event.target.files[0];
    if (!photo) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(photo.type) || photo.size > 5 * 1024 * 1024) return toast('Choose an image under 5 MB.', true);
    const path = `${state.user.id}/${crypto.randomUUID()}`;
    const { error: uploadError } = await db.storage.from('avatars').upload(path, photo, { contentType: photo.type });
    if (uploadError) return fail(uploadError);
    const { data, error } = await db.from('profiles').update({ avatar_url: path }).eq('id', state.user.id).select('id,username,avatar_url,created_at').single();
    if (error) return fail(error);
    clearAssetCache(); state.profile = data; renderApp(); await hydrateImages(app); toast('Profile picture updated.');
  });
}

function decodeBase64Url(value) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const decoded = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

async function confirmDeleteAccount() {
  if (!confirm('Permanently delete your account, profile, events and friend connections? This cannot be undone.')) return;
  const { error } = await db.functions.invoke('delete-own-account');
  if (error) return fail(error);
  await db.auth.signOut({ scope: 'local' });
  location.reload();
}

async function showNotifications() {
  const { data, error } = await db.from('notifications').select('id,event_id,friend_request_id,kind,created_at,read_at,events(name,creator:profiles!events_creator_id_fkey(username)),friend_requests(requester:profiles!friend_requests_requester_id_fkey(username))').order('created_at', { ascending: false }).limit(30);
  if (error) return fail(error);
  const rows = data || [];
  modal.innerHTML = `<div class="modal-heading"><div><p class="eyebrow">Your updates</p><h2>Notifications</h2></div><button class="icon-button" type="button" data-close aria-label="Close">×</button></div><div class="notification-list">${rows.length ? rows.map((item) => `<button class="notification-row ${item.read_at ? '' : 'unread'}" type="button" data-notification-event="${item.event_id || ''}" data-notification-kind="${item.kind}" data-notification-id="${item.id}"><span class="notification-symbol">${item.kind === 'friend_request' ? '↗' : '◷'}</span><span><strong>${item.kind === 'friend_request' ? `@${escapeHtml(item.friend_requests?.requester?.username || 'Someone')} sent you a friend request` : `${escapeHtml(item.events?.name || 'Event reminder')}${item.kind === 'reminder_15' ? ' starts in 15 minutes' : ' is starting now'} · @${escapeHtml(item.events?.creator?.username || 'friend')}`}</strong><small>${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.created_at))}</small></span></button>`).join('') : '<p class="search-empty">You’re all caught up.</p>'}</div>`;
  modal.showModal();
  modal.querySelector('[data-close]').addEventListener('click', () => modal.close());
  modal.querySelectorAll('[data-notification-id]').forEach((button) => button.addEventListener('click', async () => {
    await db.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', button.dataset.notificationId);
    const eventId = button.dataset.notificationEvent;
    if (eventId) { modal.close(); showEvent(eventId); }
    else if (button.dataset.notificationKind === 'friend_request') { modal.close(); state.tab = 'friends'; state.friendTab = 'requests'; renderApp(); }
  }));
  const unread = rows.filter((item) => !item.read_at);
  if (unread.length) await db.from('notifications').update({ read_at: new Date().toISOString() }).in('id', unread.map((item) => item.id));
  state.unreadCount = 0;
  app.querySelector('.notification-dot')?.setAttribute('hidden', '');
}

function startReminders() {
  clearInterval(state.reminderTimer);
  checkReminders();
  state.reminderTimer = setInterval(checkReminders, 30000);
}

async function checkReminders() {
  if (!state.prefs.reminders_enabled) return;
  const now = Date.now();
  for (const event of state.events) {
    if (event.all_day || event.creator_id !== state.user.id && !friendIds().includes(event.creator_id)) continue;
    const start = new Date(event.starts_at).getTime();
    const kind = state.prefs.reminder_15_enabled !== false && start - now <= 15 * 60 * 1000 && start - now > 0 ? 'reminder_15' : state.prefs.reminder_start_enabled !== false && start <= now && now - start < 60000 ? 'reminder_start' : null;
    if (!kind) continue;
    const { data, error } = await db.from('notifications').insert({ user_id: state.user.id, event_id: event.id, kind }).select('id').maybeSingle();
    if (error?.code === '23505') continue;
    if (error || !data) continue;
    state.seenNotifIds.add(data.id);
    let creator = event.creator_id === state.user.id ? state.profile : null;
    if (!creator) { try { creator = await getPerson(event.creator_id); } catch { creator = { username: 'A friend' }; } }
    const message = `${event.name} ${kind === 'reminder_15' ? 'starts in 15 minutes' : 'is starting now'} · ${creator.username}`;
    toast(message);
    if ('Notification' in window && Notification.permission === 'granted') {
      const registration = await navigator.serviceWorker?.getRegistration();
      const subscription = await registration?.pushManager?.getSubscription();
      if (!subscription) {
        const options = { body: `${kind === 'reminder_15' ? 'Starts in 15 minutes' : 'Starting now'} · ${creator.username}`, tag: `${event.id}-${kind}`, data: { url: `events-manager.html?event=${event.id}` } };
        if (registration) await registration.showNotification(event.name, options);
        else {
          const notification = new Notification(event.name, options);
          notification.onclick = () => { location.href = options.data.url; };
        }
      }
    }
    if (state.prefs.notification_sound) playNotificationSound();
  }
}

function playNotificationSound() {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.08, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(); oscillator.stop(context.currentTime + 0.18);
  } catch (error) { console.warn('Notification sound unavailable', error); }
}

function setupRealtime() {
  if (state.channel) return;
  state.channel = db.channel('gather-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => refreshData().catch(fail))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => refreshData().catch(fail))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests', filter: `recipient_id=eq.${state.user.id}` }, () => refreshData().catch(fail))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${state.user.id}` }, (payload) => {
      state.unreadCount += 1;
      app.querySelector('.notification-dot')?.removeAttribute('hidden');
      if (state.seenNotifIds.has(payload.new.id)) return;
      state.seenNotifIds.add(payload.new.id);
      if (payload.new.kind === 'friend_request') toast('You have a new friend request.');
      else toast('You have a new event reminder.');
      if (state.prefs.notification_sound) playNotificationSound();
    })
    .subscribe();
}

db?.auth.onAuthStateChange((event, session) => {
  queueMicrotask(async () => {
    const nextUser = session?.user || null;
    if (event === 'SIGNED_OUT' || !nextUser) { state.user = null; authScreen(); return; }
    if (event !== 'SIGNED_IN') return;
    if (state.user?.id === nextUser.id && state.profile) return;
    state.user = nextUser;
    try { await loadApplication(); } catch (error) { console.error(error); renderLoadError(error); }
  });
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !db || state.resumeCheck) return;
  state.resumeCheck = syncSessionOnResume()
    .catch((error) => { console.error(error); renderLoadError(error); })
    .finally(() => { state.resumeCheck = null; });
});

async function syncSessionOnResume() {
  const { data, error } = await db.auth.getSession();
  if (error) throw error;
  const nextUser = data.session?.user || null;
  if (!nextUser) {
    if (state.user) {
      state.user = null;
      state.profile = null;
      authScreen();
    }
    return;
  }
  const needsLoad = state.user?.id !== nextUser.id || !state.profile;
  state.user = nextUser;
  if (needsLoad) await loadApplication();
  else await refreshData();
}

if (!db) configScreen();
else db.auth.getSession().then(({ data, error }) => {
  if (error) return renderLoadError();
  if (error) return renderLoadError(error);
  state.user = data.session?.user || null;
  if (!state.user) return authScreen();
  loadApplication().catch((loadError) => { console.error(loadError); renderLoadError(loadError); });
});