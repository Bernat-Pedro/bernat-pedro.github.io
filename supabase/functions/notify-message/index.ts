import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers });
  try {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return Response.json({ error: 'Authentication required' }, { status: 401, headers });
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) return Response.json({ error: 'Invalid session' }, { status: 401, headers });
    const body = await request.json();
    if (typeof body.messageId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.messageId)) {
      return Response.json({ error: 'Invalid message ID' }, { status: 400, headers });
    }
    const { data: message, error: messageError } = await admin.from('messages')
      .select('id,sender_id,recipient_id,body,sender:profiles!messages_sender_id_fkey(username)')
      .eq('id', body.messageId).eq('sender_id', auth.user.id).maybeSingle();
    if (messageError) throw messageError;
    if (!message) return Response.json({ error: 'Message not found' }, { status: 404, headers });
    const pair = [message.sender_id, message.recipient_id].sort();
    const [{ data: friendship, error: friendError }, { data: preferences, error: preferenceError }] = await Promise.all([
      admin.from('friendships').select('user_low').eq('user_low', pair[0]).eq('user_high', pair[1]).maybeSingle(),
      admin.from('notification_preferences').select('notifications_enabled').eq('user_id', message.recipient_id).maybeSingle()
    ]);
    if (friendError || preferenceError) throw friendError || preferenceError;
    if (!friendship || preferences?.notifications_enabled === false) return Response.json({ sent: 0 }, { headers });
    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const subject = Deno.env.get('VAPID_SUBJECT');
    if (!publicKey || !privateKey || !subject) return Response.json({ sent: 0, reason: 'Push is not configured' }, { headers });
    const { data: claimed, error: claimError } = await admin.from('notifications')
      .update({ push_claimed_at: new Date().toISOString() }).eq('message_id', message.id)
      .eq('user_id', message.recipient_id).is('push_claimed_at', null).select('id').maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return Response.json({ sent: 0 }, { headers });
    const { data: subscriptions, error: subscriptionError } = await admin.from('push_subscriptions')
      .select('id,subscription').eq('user_id', message.recipient_id);
    if (subscriptionError) throw subscriptionError;
    webpush.setVapidDetails(subject, publicKey, privateKey);
    const sender = message.sender as unknown as { username: string } | null;
    const payload = JSON.stringify({
      title: `@${sender?.username || 'Friend'} sent you a message`,
      body: message.body.slice(0, 100), tag: `message-${message.id}`,
      url: `events-manager.html?text=${message.sender_id}`
    });
    let sent = 0;
    for (const subscription of subscriptions || []) {
      const { data: current, error: currentError } = await admin.from('notification_preferences')
        .select('notifications_enabled').eq('user_id', message.recipient_id).maybeSingle();
      if (currentError || current?.notifications_enabled === false) break;
      try { await webpush.sendNotification(subscription.subscription, payload); sent += 1; }
      catch (error) {
        const code = typeof error === 'object' && error !== null && 'statusCode' in error ? error.statusCode : undefined;
        if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('id', subscription.id);
        else console.error('Message push delivery failed', code);
      }
    }
    return Response.json({ sent }, { headers });
  } catch (error) {
    console.error('Message notification failed', error);
    return Response.json({ error: 'Could not deliver message notification' }, { status: 500, headers });
  }
});