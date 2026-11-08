import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(supabaseUrl, serviceKey);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'Authentication required' }, { status: 401, headers: corsHeaders });

  const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: userData, error: userError } = await callerClient.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ error: 'Invalid session' }, { status: 401, headers: corsHeaders });
  const { requestId } = await request.json();
  const { data: friendRequest, error: requestError } = await admin.from('friend_requests')
    .select('id,requester_id,recipient_id,status')
    .eq('id', requestId)
    .eq('requester_id', userData.user.id)
    .eq('status', 'pending')
    .maybeSingle();
  if (requestError || !friendRequest) return Response.json({ error: 'Request not found' }, { status: 404, headers: corsHeaders });

  const [{ data: preferences }, { data: sender }, { data: subscriptions }] = await Promise.all([
    admin.from('notification_preferences').select('friend_request_notifications').eq('user_id', friendRequest.recipient_id).maybeSingle(),
    admin.from('profiles').select('username').eq('id', friendRequest.requester_id).maybeSingle(),
    admin.from('push_subscriptions').select('id,subscription').eq('user_id', friendRequest.recipient_id)
  ]);
  if (preferences?.friend_request_notifications === false || !subscriptions?.length) return Response.json({ sent: 0 }, { headers: corsHeaders });

  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT');
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) return Response.json({ sent: 0, reason: 'Push is not configured' }, { headers: corsHeaders });
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  const payload = JSON.stringify({
    title: 'A new friend request',
    body: `@${sender?.username || 'Someone'} wants to connect with you.`,
    tag: `friend-request-${friendRequest.id}`,
    url: 'events-manager.html?requests=1'
  });
  let sent = 0;
  for (const subscription of subscriptions) {
    try { await webpush.sendNotification(subscription.subscription, payload); sent += 1; }
    catch (error) {
      const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error ? error.statusCode : undefined;
      if (statusCode === 404 || statusCode === 410) await admin.from('push_subscriptions').delete().eq('id', subscription.id);
    }
  }
  return Response.json({ sent }, { headers: corsHeaders });
});