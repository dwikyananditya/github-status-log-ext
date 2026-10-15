type StatusEntry = {
  at: number;
  actor?: string;
  repo?: string;
  issue?: string;
  url?: string;
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

const optionNames: Record<string, string> = {};

function actorLogin(): string | null {
  return document.querySelector<HTMLMetaElement>('meta[name="user-login"]')?.content ?? null;
}

type BoardRow = { repo?: string; issue?: string; url: string; status: string; assignees: string[] };

function boardRows(): Map<string, BoardRow> {
  const cols = [...document.querySelectorAll('[role="columnheader"]')].map((h) => {
    const full = h.textContent?.trim() ?? '';

    if (!full.endsWith(' column options')) return full;

    const body = full.slice(0, -' column options'.length);

    return body.slice(0, body.length / 2);
  });

  const statusIdx = cols.indexOf('Status');

  const assigneeIdx = cols.indexOf('Assignees');
  const rows = new Map<string, BoardRow>();

  for (const row of document.querySelectorAll('[role="row"]')) {
    const link = row.querySelector<HTMLAnchorElement>('a[href*="/issues/"], a[href*="/pulls/"]');

    if (!link) continue;

    const m = new URL(link.href).pathname.match(/^\/([^/]+)\/([^/]+)\/(?:issues|pulls)\/(\d+)/);
    const cells = [...row.querySelectorAll(':scope > [role="gridcell"], :scope > [role="rowheader"]')];

    const offset = Math.max(
      cells.findIndex((c) => c.getAttribute('role') === 'rowheader'),
      0,
    );

    const cellAt = (i: number) => (i >= 0 ? cells[i + offset] : undefined);

    rows.set(link.href, {
      repo: m ? `${m[1]}/${m[2]}` : undefined,
      issue: m ? m[3] : undefined,
      url: link.href,
      status: statusIdx >= 0 ? (cellAt(statusIdx)?.textContent?.trim() ?? '') : '',
      assignees:
        assigneeIdx >= 0
          ? [...(cellAt(assigneeIdx)?.querySelectorAll('[class*="TextCell"]') ?? [])].flatMap((el) => {
              const t = el.textContent?.trim();

              return t ? [t] : [];
            })
          : [],
    });
  }

  return rows;
}

function boardChangedRow(before: Map<string, BoardRow>): BoardRow | undefined {
  for (const [key, row] of boardRows()) {
    if (before.get(key)?.status !== row.status) return row;
  }

  return undefined;
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
        url: entry.url,
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

      const trig = data.entry;

      const entry: StatusEntry = {
        at: trig.at,
        optionId: trig.optionId,
        actor: actorLogin() ?? undefined,
        repo: trig.repo,
        issue: trig.issue,
        project: trig.project,
        optionName: trig.optionName,
        assignees: domAssignees(),
        url: location.href,
      };

      const finish = () => {
        syncToSupabase(entry);

        browser.storage.local
          .get({ log: [] })
          .then(({ log }) => {
            const entries = isStatusLog(log) ? log : [];

            entries.unshift(entry);

            return browser.storage.local.set({ log: entries.slice(0, 1000) });
          })
          .catch(() => {});
      };

      if (/\/orgs\/[^/]+\/projects\/\d+/.test(location.pathname)) {
        entry.project ??= document.title.split(' · ')[1];

        const before = boardRows();

        const attempt = (left: number): void => {
          let row = boardChangedRow(before);

          if (!row && isNum(trig.issueNumber)) {
            for (const r of boardRows().values()) {
              if (r.issue === String(trig.issueNumber)) {
                row = r;

                break;
              }
            }
          }

          if (row) {
            entry.repo = row.repo;
            entry.issue = row.issue;
            entry.url = row.url;
            entry.optionName = row.status || entry.optionName;
            if (entry.optionId && entry.optionName) optionNames[entry.optionId] = entry.optionName;
            entry.assignees =
              row.assignees.length > 0
                ? row.assignees
                : Array.isArray(trig.assignees) && trig.assignees.every(isStr) && trig.assignees.length > 0
                  ? trig.assignees
                  : entry.assignees;
          } else if (left > 0) {
            window.setTimeout(() => attempt(left - 1), 2000);

            return;
          } else {
            entry.issue ??= isNum(trig.issueNumber) ? String(trig.issueNumber) : undefined;

            const pane = new URL(location.href).searchParams.get('issue');

            if (pane) {
              const [org, repo, num] = pane.split('|');

              entry.repo ??= `${org}/${repo}`;
              entry.issue ??= num;
              entry.url = `https://github.com/${org}/${repo}/issues/${num}`;
            }

            entry.optionName ??=
              (entry.optionId ? optionNames[entry.optionId] : undefined) ?? domStatus().optionName;
          }

          finish();
        };

        window.setTimeout(() => attempt(5), 1000);
      } else {
        const fromUrl = repoIssueFromUrl();
        const dom = domStatus();

        entry.repo ??= fromUrl.repo;
        entry.issue ??= fromUrl.issue;
        entry.project ??= dom.project;
        entry.optionName ??= dom.optionName;

        finish();
      }
    });
  },
});
