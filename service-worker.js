self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { payload = { body: event.data?.text() || '' }; }
  const title = payload.title || 'Gather';
  const options = {
    body: payload.body || 'You have an update from your circle.',
    tag: payload.tag || 'gather-update',
    data: { url: payload.url || 'events-manager.html' },
    icon: 'favicon.svg',
    badge: 'favicon.svg'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || 'events-manager.html', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) {
      await existing.navigate(url);
      return existing.focus();
    }
    return self.clients.openWindow(url);
  })());
});