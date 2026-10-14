import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, x-team-token',
  'access-control-allow-methods': 'GET',
};

const MAX_LIMIT = 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  if (req.method !== 'GET') return new Response('method not allowed', { status: 405, headers: CORS });

  if (req.headers.get('x-team-token') !== Deno.env.get('TEAM_TOKEN')) {
    return new Response('unauthorized', { status: 401, headers: CORS });
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 200, MAX_LIMIT);

  let query = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
    .from('status_log')
    .select('*')
    .order('at', { ascending: false })
    .limit(limit);

  for (const key of ['repo', 'issue', 'project', 'actor', 'option_id'] as const) {
    const v = url.searchParams.get(key);
    if (v) query = query.eq(key, v);
  }

  const { data, error } = await query;

  if (error) return new Response(error.message, { status: 500, headers: CORS });

  return Response.json(data, { headers: CORS });
});
