type Json = { [k: string]: Json } | Json[] | string | number | boolean | null;

function isObj(v: Json | undefined): v is { [k: string]: Json } {
  return v != null && v.constructor === Object;
}

type SyncMessage = { type?: Json; entry?: Json };

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: SyncMessage) => {
    const msg: Json = message ?? null;

    if (!isObj(msg) || msg.type !== 'gh-status-sync' || !isObj(msg.entry)) return false;

    const url: string | undefined = import.meta.env.VITE_SUPABASE_URL;
    const token: string | undefined = import.meta.env.VITE_TEAM_TOKEN;

    if (!url || !token) return false;

    return fetch(`${url}/functions/v1/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-team-token': token },
      body: JSON.stringify(msg.entry),
    })
      .then((r) => r.ok)
      .catch(() => false);
  });
});
