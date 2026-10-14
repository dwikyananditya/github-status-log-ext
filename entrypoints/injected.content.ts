type Json = { [k: string]: Json } | Json[] | string | number | boolean | null;

function isObj(v: Json | undefined): v is { [k: string]: Json } {
  return v != null && v.constructor === Object;
}

function isStr(v: Json | undefined): v is string {
  return v != null && v.constructor === String;
}

function isNum(v: Json | undefined): v is number {
  return v != null && v.constructor === Number;
}

type Trigger = {
  optionId: string;
  projectId?: string;
  itemId?: string;
  issueNumber?: number;
  assignees?: string[];
};

type Resolved = { repo?: string; issue?: string; project?: string; optionName?: string };

function resolveMemex(text: string): { issueNumber?: number; assignees?: string[] } | null {
  try {
    const item: Json = JSON.parse(text).memexProjectItem;
    const cols: Json[] = isObj(item) && Array.isArray(item.memexProjectColumnValues) ? item.memexProjectColumnValues : [];
    const title = cols.find((c) => isObj(c) && c.memexProjectColumnId === 'Title');
    const assignees = cols.find((c) => isObj(c) && c.memexProjectColumnId === 'Assignees');
    const tv = isObj(title) ? title.value : undefined;
    const av = isObj(assignees) ? assignees.value : undefined;

    return {
      issueNumber: isObj(tv) && isNum(tv.number) ? tv.number : undefined,
      assignees: Array.isArray(av) ? av.flatMap((a) => (isObj(a) && isStr(a.login) ? [a.login] : [])) : undefined,
    };
  } catch {
    return null;
  }
}

function walk(node: Json, fn: (o: { [k: string]: Json }) => void) {
  if (Array.isArray(node)) {
    node.forEach((n) => walk(n, fn));

    return;
  }

  if (!isObj(node)) return;

  fn(node);

  for (const v of Object.values(node)) walk(v, fn);
}

function triggerIn(text: string): Trigger | null {
  if (!text.includes('singleSelectOptionId') && !text.includes('memexProjectColumnValues')) return null;

  try {
    let hit: Trigger | null = null;

    walk(JSON.parse(text), (o) => {
      if (hit) return;

      const optId = o.singleSelectOptionId;

      if (isStr(optId)) {
        hit = {
          optionId: optId,
          projectId: isStr(o.projectId) ? o.projectId : undefined,
          itemId: isStr(o.itemId) ? o.itemId : undefined,
        };

        return;
      }

      const cols = o.memexProjectColumnValues;
      const status = Array.isArray(cols) ? cols.find((v) => isObj(v) && v.memexProjectColumnId === 'Status') : undefined;

      if (isObj(status) && isStr(status.value) && isNum(o.memexProjectItemId)) {
        hit = { optionId: status.value, itemId: String(o.memexProjectItemId) };
      }
    });

    return hit;
  } catch {
    return null;
  }
}

function resolveIn(text: string, optionId: string): Resolved | null {
  if (!text.includes('fieldValues')) return null;

  try {
    let hit: Resolved | null = null;

    walk(JSON.parse(text), (o) => {
      if (hit || !Array.isArray(o.fieldValues)) return;

      const status = o.fieldValues.find((v) => isObj(v) && v.optionId === optionId);

      if (!isObj(status) || !isStr(status.name)) return;

      const content = o.content;
      const proj = o.project;

      const resolved: Resolved = {
        optionName: status.name,
        project: isObj(proj) && isStr(proj.title) ? proj.title : undefined,
      };

      if (
        isObj(content) &&
        isObj(content.repository) &&
        isStr(content.repository.nameWithOwner) &&
        isNum(content.number)
      ) {
        resolved.repo = content.repository.nameWithOwner;
        resolved.issue = String(content.number);
      }

      hit = resolved;
    });

    return hit;
  } catch {
    return null;
  }
}

export default defineContentScript({
  matches: ['https://github.com/*'],
  world: 'MAIN',
  runAt: 'document_start',

  main() {
    const orig = window.fetch.bind(window);

    window.fetch = async (input, init) => {
      const reqText: string | null =
        init?.body != null && init.body.constructor === String
          ? init.body.toString()
          : input instanceof Request
            ? await input.clone().text().catch(() => null)
            : null;

      const trigger = reqText ? triggerIn(reqText) : null;
      const res = await orig(input, init);

      if (trigger) {
        try {
          const text = await res.clone().text();

          const resolved = text.includes('memexProjectItem')
            ? resolveMemex(text)
            : resolveIn(text, trigger.optionId);

          window.postMessage(
            {
              source: 'gh-status-ext',
              kind: 'log',
              entry: { at: Date.now(), ...trigger, ...resolved },
            },
            window.location.origin,
          );
        } catch {
          window.postMessage(
            { source: 'gh-status-ext', kind: 'log', entry: { at: Date.now(), ...trigger } },
            window.location.origin,
          );
        }
      }

      return res;
    };

    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.send = function (body) {
      try {
        if (body != null && body.constructor === String) {
          const trigger = triggerIn(body.toString());

          if (trigger) {
            window.postMessage(
              { source: 'gh-status-ext', kind: 'log', entry: { at: Date.now(), ...trigger } },
              window.location.origin,
            );
          }
        }
      } catch {}

      origSend.call(this, body);
    };
  },
});
