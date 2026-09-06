import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { setImmediate } from 'node:timers/promises';

function statusHtml() {
  const data = { page: { components: [{ component_id: 'api', name: 'API' }] }, active_changes: [], changes: [], component_uptimes: [], initialDataUpdatedAt: 123 };
  return `<script>self.__next_f.push([1,${JSON.stringify(JSON.stringify(data))}])</script>`;
}

async function host(api, { available = true } = {}) {
  const timers = new Set(), cleanup = [], handlers = new Map();
  let route, hooks, source, failFetch = false;
  const interval = (callback, delay) => {
    const timer = { callback, delay };
    timers.add(timer);
    return () => timers.delete(timer);
  };
  const install = (owner, ns, schema, entry, consumer) => {
    assert.equal(owner, ctx);
    assert.equal(ns, 'deepseek-status');
    hooks = consumer; source = entry;
    hooks.setSource(() => source);
    hooks.onChange();
  };
  let connect;
  const ctx = {
    settings: { installSection: install },
    setInterval: interval,
    inject(dependencies, callback) { assert.deepEqual(Array.from(dependencies), ['settings']); connect = () => callback(ctx); if (available) connect(); },
    on(event, callback) { handlers.set(event, callback); },
    effect(callback) { const dispose = callback(); if (typeof dispose === 'function') cleanup.push(dispose); return dispose; },
    webServer: { register(value) { route = value; return () => { route = null; }; } },
    logger: { info() {}, warn() {} },
  };
  const context = vm.createContext({
    AbortSignal,
    fetch: async () => { if (failFetch) throw new Error('upstream unavailable'); return { ok: true, text: async () => statusHtml() }; },
  });
  const schema = () => ({ default() { return this; }, min() { return this; }, max() { return this; } });
  const schemastery = new vm.SyntheticModule(['default'], function () { this.setExport('default', { object: value => value, string: schema, number: schema }); }, { context });
  const settings = new vm.SyntheticModule(api === 'legacy' ? ['installSettingsSection'] : [], function () {
    if (api === 'legacy') this.setExport('installSettingsSection', install);
  }, { context });
  const parser = new vm.SourceTextModule(await readFile(new URL('../lib/parser.js', import.meta.url), 'utf8'), { context });
  const plugin = new vm.SourceTextModule(await readFile(new URL('../lib/index.js', import.meta.url), 'utf8'), { context });
  await plugin.link(name => {
    if (name === '@deepseek-ai/schemastery') return schemastery;
    if (name === '@deepseek-ai/dsh-settings') return settings;
    if (name === './parser.js') return parser;
    throw new Error(`Unexpected import: ${name}`);
  });
  await plugin.evaluate();
  plugin.namespace.apply(ctx, { pollIntervalMs: 60000 });
  await setImmediate();
  return {
    timers,
    connect: () => connect(),
    update(interval) { source = { pollIntervalMs: interval }; hooks.onChange(); handlers.get('settings/updated')?.('deepseek-status'); },
    failFetch() { failFetch = true; },
    async tick() { [...timers][0].callback(); await setImmediate(); },
    async response() {
      let status, body;
      assert.equal(route.path, '/deepseek-status/current');
      await route.handler({}, { writeHead(value) { status = value; }, end(value) { body = JSON.parse(value); } });
      assert.equal(status, 200);
      return body;
    },
    dispose() { for (const dispose of cleanup.reverse()) dispose(); },
  };
}

for (const api of ['legacy', 'provider']) {
  test(`${api} settings API: import, hot updates and unload keep one disposable poller`, async () => {
    const plugin = await host(api);
    assert.equal(plugin.timers.size, 1);
    assert.equal((await plugin.response()).overall, 'operational');
    for (const delay of [30000, 45000, 120000]) {
      plugin.update(delay);
      assert.equal(plugin.timers.size, 1);
      assert.equal([...plugin.timers][0].delay, delay);
    }
    plugin.dispose();
    assert.equal(plugin.timers.size, 0);
  });
}

test('an absent optional settings provider uses entry config and can attach later', async () => {
  const plugin = await host('provider', { available: false });
  assert.equal(plugin.timers.size, 1);
  assert.equal([...plugin.timers][0].delay, 60000);
  plugin.connect();
  plugin.update(90000);
  assert.equal(plugin.timers.size, 1);
  assert.equal([...plugin.timers][0].delay, 90000);
  plugin.dispose();
});

test('upstream failure preserves the last snapshot and reports the failure', async () => {
  const plugin = await host('provider');
  const before = await plugin.response();
  plugin.failFetch();
  await plugin.tick();
  const after = await plugin.response();
  assert.equal(after.fetchedAt, before.fetchedAt);
  assert.deepEqual(after.components, before.components);
  assert.equal(after.error, 'upstream unavailable');
  plugin.dispose();
});
