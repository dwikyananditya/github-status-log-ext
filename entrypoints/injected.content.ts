type Json = { [k: string]: Json } | Json[] | string | number | boolean | null;

function isObj(v: Json | undefined): v is { [k: string]: Json } {
  return v != null && v.constructor === Object;
}

function isStr(v: Json | undefined): v is string {
  return v != null && v.constructor === String;
}

export default defineContentScript({
  matches: ['https://github.com/*'],
  world: 'MAIN',
  runAt: 'document_start',

  main() {
    const orig = window.fetch.bind(window);

    function collect(node: Json) {
      if (Array.isArray(node)) {
        node.forEach(collect);

        return;
      }

      if (!isObj(node)) return;

      const optId = node.singleSelectOptionId;

      if (isStr(optId)) {
        const pid = node.projectId;
        const iid = node.itemId;

        window.postMessage(
          {
            source: 'gh-status-ext',
            kind: 'log',
            entry: {
              at: Date.now(),
              projectId: isStr(pid) ? pid : undefined,
              itemId: isStr(iid) ? iid : undefined,
              optionId: optId,
            },
          },
          window.location.origin,
        );

        return;
      }

      for (const v of Object.values(node)) collect(v);
    }

    function inspect(text: string) {
      try {
        if (!text.includes('singleSelectOptionId')) return;

        collect(JSON.parse(text));
      } catch {}
    }

    window.fetch = async (input, init) => {
      const bodyPromise: Promise<string> | null =
        init?.body != null && init.body.constructor === String
          ? Promise.resolve(init.body.toString())
          : input instanceof Request
            ? input.clone().text()
            : null;

      if (bodyPromise) bodyPromise.then(inspect).catch(() => {});

      const res = await orig(input, init);

      return res;
    };

    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.send = function (body) {
      try {
        if (body != null && body.constructor === String) inspect(body.toString());
      } catch {}

      origSend.call(this, body);
    };
  },
});
