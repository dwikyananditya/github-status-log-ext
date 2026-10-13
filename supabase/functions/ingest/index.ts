import { createClient } from 'jsr:@supabase/supabase-js@2';

type Payload = {
  at?: unknown;
  actor?: unknown;
  repo?: unknown;
  issue?: unknown;
  project?: unknown;
  assignees?: unknown;
  option_id?: unknown;
  option_name?: unknown;
};

function str(v: unknown): v is string {
  return v != null && v.constructor === String;
}

const VALID_KEYS = ['at', 'actor', 'repo', 'issue', 'project', 'assignees', 'option_id', 'option_name'];

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, x-team-token',
  'access-control-allow-methods': 'POST',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS });

  if (req.headers.get('x-team-token') !== Deno.env.get('TEAM_TOKEN')) {
    return new Response('unauthorized', { status: 401, headers: CORS });
  }

  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return new Response('invalid json', { status: 400, headers: CORS });
  }

  const rows = (Array.isArray(body) ? body : [body]).map((raw: Payload) => {
    const row: Record<string, unknown> = {};

    for (const key of VALID_KEYS) {
      const v = raw[key as keyof Payload];

      if (key === 'at') {
        if (str(v)) row.at = new Date(v as string).toISOString();
      } else if (key === 'assignees') {
        if (Array.isArray(v)) row.assignees = v.filter(str);
      } else if (str(v)) {
        row[key] = v;
      }
    }

    if (!row.at) row.at = new Date().toISOString();
    if (!str(row.option_id)) row.option_id = null;

    return row;
  }).filter((r) => str(r.option_id));

  if (rows.length === 0) return new Response('nothing to insert', { status: 400, headers: CORS });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { error } = await supabase.from('status_log').insert(rows);

  if (error) return new Response(error.message, { status: 500, headers: CORS });

  return Response.json({ inserted: rows.length }, { headers: CORS });
});
