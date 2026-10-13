type StatusEntry = {
  at: number;
  actor?: string;
  repo?: string;
  issue?: string;
  project?: string;
  assignees: string[];
  optionId: string;
  optionName: string | null;
};

function isNum(v: unknown): v is number {
  return v != null && v.constructor === Number;
}

function isStr(v: unknown): v is string {
  return v != null && v.constructor === String;
}

function isObj(v: unknown): v is { [k: string]: Json } {
  return v != null && v.constructor === Object;
}

type Json = { [k: string]: Json } | Json[] | string | number | boolean | null;

function isStatusEntry(v: unknown): v is StatusEntry {
  return isObj(v) && isNum(v.at) && isStr(v.optionId);
}

function isStatusLog(v: unknown): v is StatusEntry[] {
  return Array.isArray(v);
}

function domAssignees(): string[] {
  const label = document
    .evaluate(
      '//*[normalize-space(text())="Assignees"]',
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null,
    )
    .singleNodeValue;

  if (!(label instanceof Element)) return [];

  const section =
    label.closest('[class*="ProjectItemSectionContainer"]') ?? label.parentElement?.parentElement;

  if (!section) return [];

  const names = [...section.querySelectorAll('img[alt], a[href^="/"]')].flatMap((el) => {
    const n = el instanceof HTMLImageElement ? el.alt : (el.getAttribute('href')?.replace('/', '') ?? '');

    return isStr(n) && n && !n.includes('/') && n !== 'Assignees' ? [n] : [];
  });

  return [...new Set(names)];
}

function repoIssueFromUrl(): { repo?: string; issue?: string } {
  const m = location.pathname.match(/^\/([^/]+)\/([^/]+)\/issues\/(\d+)/);

  return m ? { repo: `${m[1]}/${m[2]}`, issue: m[3] } : {};
}

type DomStatus = { project?: string; optionName: string | null };

function domStatus(): DomStatus {
  const label = document
    .evaluate('//*[normalize-space(text())="Status"]', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
    .singleNodeValue;

  if (!(label instanceof Element)) return { optionName: null };

  const section =
    label.closest('[class*="ProjectItemSectionContainer"]') ?? label.parentElement?.parentElement;

  if (!section) return { optionName: null };

  const spans = [...section.querySelectorAll('span')].filter((el) => el.childElementCount === 0);

  for (const el of spans) {
    const t = el.textContent?.trim();

    if (t && t !== 'Status') {
      const project = [...section.querySelectorAll('div')].find((el) =>
        el.className.includes('Truncate'),
      )?.textContent?.trim();

      return { project, optionName: t };
    }
  }

  return { optionName: null };
}

function actorLogin(): string | null {
  return document.querySelector<HTMLMetaElement>('meta[name="user-login"]')?.content ?? null;
}

function syncToSupabase(entry: StatusEntry) {
  const url: string | undefined = import.meta.env.VITE_SUPABASE_URL;
  const token: string | undefined = import.meta.env.VITE_TEAM_TOKEN;

  if (!url || !token) return;

  void browser.runtime
    .sendMessage({
      type: 'gh-status-sync',
      entry: {
        at: new Date(entry.at).toISOString(),
        actor: entry.actor,
        repo: entry.repo,
        issue: entry.issue,
        project: entry.project,
        assignees: entry.assignees,
        option_id: entry.optionId,
        option_name: entry.optionName,
      },
    })
    .catch(() => {});
}

export default defineContentScript({
  matches: ['https://github.com/*'],

  main() {
    window.addEventListener('message', (e) => {
      if (e.origin !== window.location.origin) return;

      const data = e.data;

      if (data?.source !== 'gh-status-ext' || data?.kind !== 'log' || !isStatusEntry(data.entry)) return;

      if (!browser.runtime?.id) return;

      const entry: StatusEntry = {
        ...data.entry,
        actor: actorLogin() ?? undefined,
        assignees: domAssignees(),
        ...repoIssueFromUrl(),
        ...domStatus(),
      };

      syncToSupabase(entry);

      browser.storage.local
        .get({ log: [] })
        .then(({ log }) => {
          const entries = isStatusLog(log) ? log : [];

          entries.unshift(entry);

          return browser.storage.local.set({ log: entries.slice(0, 1000) });
        })
        .catch(() => {});
    });
  },
});
