// Guards the shape of the host half's exported Config schema.
//
// The Host settings service projects an editable form only for entries whose
// Config has volatile fields (`dsh-settings`: "Forms expose only volatile
// fields from active, uniquely addressed profile entries"). Without
// `.volatile()` the plugin still loads and polls, but its settings silently
// vanish from the UI — the exact regression this suite exists to prevent.
//
// `@deepseek-ai/schemastery` is a peer dependency, so it is not vendored here;
// install it locally (`node_modules/@deepseek-ai/schemastery`) to run this
// file. When it is absent the guard is skipped rather than failed, so the rest
// of the suite still runs on a bare checkout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

async function loadHost() {
  try {
    const entry = require.resolve('@deepseek-ai/schemastery');
    await import(pathToFileURL(entry).href); // prove it is loadable before importing the host half
  } catch {
    return null;
  }
  const hostPath = fileURLToPath(new URL('../lib/index.js', import.meta.url));
  return import(pathToFileURL(hostPath).href);
}

const host = await loadHost();
const skip = host === null ? 'install @deepseek-ai/schemastery to run the schema guard' : false;

test('every config field is volatile, which is what publishes the settings form', { skip }, () => {
  assert.ok(host.Config !== undefined, 'the host half must export Config');
  const json = host.Config.toJSON();
  const fields = Object.values(json.refs).filter((node) => node.type !== 'object');
  assert.ok(fields.length >= 3, `expected three config fields, saw ${fields.length}`);
  for (const node of fields) {
    assert.equal(node.meta?.volatile, true, 'each config field must be volatile, or the settings form is not published');
  }
});

test('parsed fields are live references and the documented defaults survive', { skip }, () => {
  const parsed = host.Config({});
  assert.equal(parsed.statusUrl.get(), 'https://status.deepseek.com/');
  assert.equal(parsed.pollIntervalMs.get(), 60000);
  assert.equal(parsed.timeoutMs.get(), 15000);

  const custom = host.Config({ pollIntervalMs: 120000 });
  assert.equal(custom.pollIntervalMs.get(), 120000);

  // The settings form writes plain values back, so simplify() must unwrap the
  // references, and an untouched field must stay out of the persisted patch.
  assert.deepEqual(host.Config.simplify(custom), { pollIntervalMs: 120000 });
});
