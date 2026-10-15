import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { setImmediate } from 'node:timers/promises';

function statusHtml() {
  const data = { page: { components: [{ component_id: 'api', name: 'API' }] }, active_changes: [], changes: [], component_uptimes: [], initialDataUpdatedAt: 123 };
  return `<script>self.__next_f.push([1,${JSON.stringify(JSON.stringify(data))}])</script>`;
}

async function host(entryConfig, { fail = false } = {}) {
  const timers = new Set(), cleanup = [], handlers = new Map();
  let route, failFetch = fail;
  const interval = (callback, delay) => {
    const timer = { callback, delay };
    timers.add(timer);
    return () => timers.delete(timer);
  };
  const ctx = {
    setInterval: interval,
    inject() { throw new Error('the host half must not inject a settings service'); },
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
  const parser = new vm.SourceTextModule(await readFile(new URL('../lib/parser.js', import.meta.url), 'utf8'), { context });
  const plugin = new vm.SourceTextModule(await readFile(new URL('../lib/index.js', import.meta.url), 'utf8'), { context });
  await plugin.link(name => {
    if (name === '@deepseek-ai/schemastery') return schemastery;
    if (name === './parser.js') return parser;
    throw new Error(`Unexpected import: ${name}`);
  });
  await plugin.evaluate();
  plugin.namespace.apply(ctx, entryConfig);
  await setImmediate();
  return {
    timers,
    handlers,
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

test('host half imports without any settings package', async () => {
  // The vm linker above throws on an unexpected import, so reaching this line
  // means lib/index.js no longer imports @deepseek-ai/dsh-settings, and apply()
  // never injects a settings service.
  const plugin = await host({});
  assert.equal(plugin.timers.size, 1);
  plugin.dispose();
  assert.equal(plugin.timers.size, 0);
});

test('the row config sets one poller delay', async () => {
  const plugin = await host({ pollIntervalMs: 90000 });
  assert.equal(plugin.timers.size, 1);
  assert.equal([...plugin.timers][0].delay, 90000);
  assert.equal((await plugin.response()).overall, 'operational');
  plugin.dispose();
  assert.equal(plugin.timers.size, 0);
});

test('a missing row config falls back to the documented defaults', async () => {
  const plugin = await host(undefined);
  assert.equal(plugin.timers.size, 1);
  assert.equal([...plugin.timers][0].delay, 60000);
  plugin.dispose();
});

test('an unknown config shape cannot produce a broken delay', async () => {
  const plugin = await host({ pollIntervalMs: 0, statusUrl: '', timeoutMs: -1 });
  assert.equal([...plugin.timers][0].delay, 60000);
  plugin.dispose();
});

test('upstream failure preserves the last snapshot and reports the failure', async () => {
  const plugin = await host({ pollIntervalMs: 60000 });
  const before = await plugin.response();
  plugin.failFetch();
  await plugin.tick();
  const after = await plugin.response();
  assert.equal(after.fetchedAt, before.fetchedAt);
  assert.deepEqual(after.components, before.components);
  assert.equal(after.error, 'upstream unavailable');
  plugin.dispose();
});
