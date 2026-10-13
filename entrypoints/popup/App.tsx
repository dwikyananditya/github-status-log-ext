import { useEffect, useState } from 'react';

export type StatusEntry = {
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

function where(e: StatusEntry): string {
  if (e.repo) return e.issue ? `${e.repo}#${e.issue}` : e.repo;

  return e.optionId;
}

export default function App() {
  const [entries, setEntries] = useState<StatusEntry[] | null>(null);

  useEffect(() => {
    browser.storage.local
      .get({ log: [] })
      .then(({ log }) => {
        setEntries(isStatusLog(log) ? log.filter(isStatusEntry) : []);
      })
      .catch(() => setEntries([]));
  }, []);

  return (
    <div className="w-96">
      {entries === null ? (
        <p className="p-3 text-sm text-muted-foreground">Memuat…</p>
      ) : entries.length === 0 ? (
        <p className="p-3 text-sm text-muted-foreground">
          Belum ada perubahan tercatat. Ganti status di project, lalu buka lagi.
        </p>
      ) : (
        <ul className="divide-y">
          {entries.map((e) => (
            <li key={`${e.at}-${e.optionId}`} className="px-3 py-2 flex items-center justify-between gap-3">
              <div>
                <span className="badge badge-secondary shrink-0" title={e.project}>
                  {e.optionName ?? e.optionId}
                </span>
                {e.actor && (
                  <div className="text-xs text-muted-foreground mt-0.5">@{e.actor}</div>
                )}
              </div>
              <span className="text-xs text-muted-foreground text-right truncate">
                {where(e)} · {new Date(e.at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
