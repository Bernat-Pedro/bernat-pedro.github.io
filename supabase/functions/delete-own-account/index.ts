import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(supabaseUrl, serviceKey);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return Response.json({ error: 'Authentication required' }, { status: 401, headers: corsHeaders });
  const { data, error: authError } = await admin.auth.getUser(token);
  if (authError || !data.user) return Response.json({ error: 'Invalid session' }, { status: 401, headers: corsHeaders });
  const userId = data.user.id;

  for (const bucket of ['avatars', 'event-photos']) {
    while (true) {
      const { data: files, error: listError } = await admin.storage.from(bucket).list(userId, { limit: 1000 });
      if (listError) return Response.json({ error: `Could not remove ${bucket} files` }, { status: 500, headers: corsHeaders });
      const paths = (files || []).filter((file) => file.name).map((file) => `${userId}/${file.name}`);
      if (!paths.length) break;
      const { error: removeError } = await admin.storage.from(bucket).remove(paths);
      if (removeError) return Response.json({ error: `Could not remove ${bucket} files` }, { status: 500, headers: corsHeaders });
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) return Response.json({ error: deleteError.message }, { status: 500, headers: corsHeaders });
  return Response.json({ deleted: true }, { headers: corsHeaders });
});