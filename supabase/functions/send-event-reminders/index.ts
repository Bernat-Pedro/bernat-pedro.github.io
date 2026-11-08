import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
const vapidSubject = Deno.env.get('VAPID_SUBJECT');
const canPush = Boolean(vapidPublicKey && vapidPrivateKey && vapidSubject);
if (canPush) webpush.setVapidDetails(vapidSubject!, vapidPublicKey!, vapidPrivateKey!);

Deno.serve(async (request) => {
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret || request.headers.get('Authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  const { data: events, error: eventError } = await supabase.from('events')
    .select('id,creator_id,name,starts_at,all_day')
    .eq('all_day', false)
    .gte('starts_at', new Date(now - 60_000).toISOString())
    .lte('starts_at', new Date(now + 15 * 60_000).toISOString());
  if (eventError) return Response.json({ error: eventError.message }, { status: 500 });

  let created = 0;
  let pushed = 0;
  for (const event of events || []) {
    const remaining = new Date(event.starts_at).getTime() - now;
    const kind = remaining > 14 * 60_000 && remaining <= 15 * 60_000
      ? 'reminder_15'
      : remaining <= 0 && remaining > -60_000
        ? 'reminder_start'
        : null;
    if (!kind) continue;

    const { data: links, error: friendshipError } = await supabase.from('friendships')
      .select('user_low,user_high')
      .or(`user_low.eq.${event.creator_id},user_high.eq.${event.creator_id}`);
    if (friendshipError) continue;
    const recipientIds = new Set([event.creator_id]);
    for (const link of links || []) recipientIds.add(link.user_low === event.creator_id ? link.user_high : link.user_low);
    const recipients = [...recipientIds];

    const [{ data: preferences }, { data: creator }] = await Promise.all([
      supabase.from('notification_preferences').select('user_id,reminders_enabled,reminder_15_enabled,reminder_start_enabled').in('user_id', recipients),
      supabase.from('profiles').select('username').eq('id', event.creator_id).maybeSingle()
    ]);
    const prefByUser = new Map((preferences || []).map((preference) => [preference.user_id, preference]));

    for (const userId of recipients) {
      const preference = prefByUser.get(userId);
      if (preference?.reminders_enabled === false) continue;
      if (kind === 'reminder_15' && preference?.reminder_15_enabled === false) continue;
      if (kind === 'reminder_start' && preference?.reminder_start_enabled === false) continue;

      const { data: notification, error: insertError } = await supabase.from('notifications')
        .insert({ user_id: userId, event_id: event.id, kind })
        .select('id')
        .maybeSingle();
      if (insertError?.code === '23505') continue;
      if (insertError || !notification) continue;
      created += 1;

      if (!canPush) continue;
      const { data: subscriptions } = await supabase.from('push_subscriptions')
        .select('id,endpoint,subscription')
        .eq('user_id', userId);
      const payload = JSON.stringify({
        title: event.name,
        body: `${kind === 'reminder_15' ? 'Starts in 15 minutes' : 'Starting now'} · @${creator?.username || 'friend'}`,
        tag: `${event.id}-${kind}`,
        url: `events-manager.html?event=${event.id}`
      });
      for (const subscription of subscriptions || []) {
        try {
          await webpush.sendNotification(subscription.subscription, payload);
          pushed += 1;
        } catch (error) {
          const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error ? error.statusCode : undefined;
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', subscription.id);
          }
        }
      }
    }
  }

  return Response.json({ events_checked: events?.length || 0, notifications_created: created, push_deliveries: pushed });
});