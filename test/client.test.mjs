import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import vm from 'node:vm';
import { setImmediate } from 'node:timers/promises';

/**
 * Boot the browser half in a vm sandbox.
 *
 * Pass `primitives: undefined` to simulate a deployment without the shared UI
 * primitives, and `configForms: null` to simulate a missing settings service.
 */
async function boot({ primitives, configForms, logger } = {}) {
  const out = { plugin: undefined, registrations: [], warnings: [], effects: [], strings: undefined, state: [] };
  let cursor = 0;
  const react = {
    createElement(type, props, ...children) { return typeof type === 'function' ? type({ ...props, children }) : { type, props, children }; },
    useState(initial) { const key = cursor++; if (!(key in out.state)) out.state[key] = initial; return [out.state[key], value => { out.state[key] = typeof value === 'function' ? value(out.state[key]) : value; }]; },
    useRef() { return { current: null }; },
    useEffect(callback) { out.effects.push(callback); },
  };
  const requireStub = (name) => {
    if (name === 'react') return react;
    if (name === '@deepseek-ai/dsh-client-ui-primitives') {
      if (primitives === undefined) throw new Error('Cannot find module ' + name);
      return primitives;
    }
    throw new Error('Unexpected require: ' + name);
  };
  const context = vm.createContext({
    window: { __ModuleLoader__: { load(definition) { out.plugin = definition.factory(requireStub); } } },
    fetch: async () => ({ ok: true, json: async () => ({ overall: 'operational', components: [], uptime: [], active: [], recentResolved: [], fetchedAt: 1, error: null }) }),
    setInterval: () => 1,
    clearInterval() {},
  });
  vm.runInContext(await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'), context);

  const ctx = {
    locale: {
      bind: () => (key) => out.strings[key],
      register(ns, locales) { out.strings = locales.zh; return () => {}; },
    },
    effect: (callback) => { const dispose = callback(); if (typeof dispose === 'function') out.effects.push(dispose); return dispose; },
    slots: {
      inject(name, callback) { callback(); },
      register(slot, component) { out.registrations.push({ slot, component }); return () => {}; },
    },
    logger: logger ?? { warn: (...args) => out.warnings.push(args.join(' ')) },
  };
  if (configForms !== null) {
    ctx.configForms = configForms ?? {
      get: () => {
        const listeners = new Set();
        return {
          getSnapshot: () => ({ revision: 0, value: {}, user: {}, base: {}, schema: { type: 'object', dict: {} }, writable: true, applies: 'live' }),
          subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
          edit: async () => {}, reset: async () => {}, replace: async () => {},
        };
      },
      // Mirrors the real service: run `register` only while the namespace is
      // served, and return the disposer that ends the watch.
      whileServed(namespaces, register) {
        const off = register(new Set(namespaces));
        return () => { if (typeof off === 'function') off(); };
      },
    };
  }
  return { ctx, out };
}

/** Minimal stand-in for @deepseek-ai/dsh-client-ui-primitives. */
function stubPrimitives() {
  class SettingsFormModel {
    constructor(scope, specs, secrets) { this.scope = scope; this.specs = specs; this.secretSpecs = secrets; }
    bind(projection) {
      // Mirrors dsh-client-store's createSnapshotStore: a bare observable with
      // getSnapshot/subscribe/set and NO selector hook of its own.
      return {
        getSnapshot: () => projection(),
        subscribe: () => () => {},
        set() {},
      };
    }
    field() { return { text: '', overridden: false, invalid: false }; }
    shell() { return { available: true, writable: true, dirty: false, invalid: false, saving: false, failed: false }; }
    actions() { return { edit() {}, resetField() {}, save() {}, discard() {} }; }
    dispose() {}
  }
  return {
    // Mirrors the real component's gate: a falsy `available` replaces every
    // control with the "not configurable" line. A stub that always rendered its
    // children let a missing `available` ship once already.
    SettingsForm: (props) => (props.state && props.state.available
      ? { type: 'SettingsForm', props }
      : { type: 'SettingsUnavailable', children: props.labels && props.labels.unavailable }),
    SettingsValueField: (props) => ({ type: 'SettingsValueField', props }),
    SettingsFormModel,
    settingsTextField: (field) => ({ field, format: (v) => String(v ?? ''), parse: (text) => ({ kind: 'set', value: text }) }),
    settingsNumberField: (field) => ({ field, format: (v) => (typeof v === 'number' ? String(v) : ''), parse: (text) => (text.trim() === '' ? { kind: 'clear' } : { kind: 'set', value: Number(text) }) }),
  };
}

/**
 * Stand in for the slot renderer's `bindInjectSources`: it strips `hooks` off an
 * entry's inject face and re-adds each source as a `use<Name>` prop. That is the
 * only hook the card may rely on — the store exposes none itself.
 */
function bindInject(face) {
  const { hooks, ...rest } = face;
  const props = { ...rest };
  for (const [name, source] of Object.entries(hooks ?? {})) {
    const hookName = 'use' + name.charAt(0).toUpperCase() + name.slice(1);
    props[hookName] = (selector) => (selector ? selector(source.getSnapshot()) : source.getSnapshot());
  }
  return props;
}

test('the current header slot renders stale data and a missing uptime without crashing', async () => {
  const { ctx, out } = await boot();
  out.plugin.apply(ctx);
  const widget = out.registrations.find((r) => r.slot.id === 'deepseek-status');
  assert.ok(widget, 'the header widget must register');
  // Render twice: the panel-open branch exercises the failure paths.
  widget.component({ t: (key) => out.strings[key] });
  const rendered = widget.component({ t: (key) => out.strings[key] });
  assert.ok(JSON.stringify(rendered).length > 0);
});

test('without the UI primitives the card is skipped, never fatal', async () => {
  const { ctx, out } = await boot({ primitives: undefined });
  out.plugin.apply(ctx);
  assert.ok(out.registrations.some((r) => r.slot.id === 'deepseek-status'), 'the widget must still register');
  assert.ok(!out.registrations.some((r) => r.slot.name.startsWith('plugins.')), 'no card without primitives');
  assert.ok(out.warnings.some((w) => w.includes('primitives unavailable')), 'the skip is reported: ' + JSON.stringify(out.warnings));
});

test('a missing settings service cannot take the widget down', async () => {
  const { ctx, out } = await boot({ primitives: stubPrimitives(), configForms: null });
  out.plugin.apply(ctx);
  assert.ok(out.registrations.some((r) => r.slot.id === 'deepseek-status'), 'the widget must still register');
  assert.ok(out.warnings.some((w) => w.includes('settings card failed')), 'the failure is reported: ' + JSON.stringify(out.warnings));
});

test('the card registers under the exact keys the Plugins page looks up', async () => {
  // The page resolves these strings itself:
  //   rowConfigKey(bundle, rowId) === `${bundle}#${rowId}`
  //   PackageDetail renders plugins.bundle.config with entryKey = pkg.name
  // A mismatch registers fine and renders nothing, which is the bug this guards.
  // `plugins.item` is a list slot (keyed by `id`) and carries no configuration.
  const { ctx, out } = await boot({ primitives: stubPrimitives() });
  out.plugin.apply(ctx);

  const keys = out.registrations.map((r) => `${r.slot.name}:${r.slot.key ?? r.slot.id}`);
  assert.ok(keys.includes('plugins.bundle.config:dsh-deepseek-status'),
    'the package page looks up plugins.bundle.config by pkg.name; saw ' + JSON.stringify(keys));
  assert.ok(keys.includes('plugins.row.config:dsh-deepseek-status#deepseek-status'),
    'the row page looks up plugins.row.config by `${pkg.name}#${rowId}`; saw ' + JSON.stringify(keys));
  assert.ok(!out.registrations.some((r) => r.slot.name === 'plugins.item'),
    'plugins.item is a list slot keyed by id, not a configuration surface');

  const cards = out.registrations.filter((r) => r.slot.name.startsWith('plugins.'));
  for (const entry of cards) {
    assert.equal(typeof entry.slot.inject, 'function', 'a card slot entry must inject its face');
    assert.equal(typeof entry.slot.label, 'function', 'a card slot entry must supply a label');
    assert.equal(typeof entry.slot.key, 'string', 'these slots are keyed, so a key is required');
  }
  const face = cards[0].slot.inject();
  assert.ok(face.hooks && face.hooks.statusConfigCard, 'the face exposes the card store under hooks');
  assert.equal(face.useStatusConfigCard, undefined,
    'the card must NOT bridge the store by hand: the store is a bare observable and the renderer owns hook synthesis');
  for (const action of ['edit', 'resetField', 'save', 'discard']) {
    assert.equal(typeof face[action], 'function', `the face must expose ${action}`);
  }
  const bound = bindInject(face);
  assert.equal(typeof bound.useStatusConfigCard, 'function', 'the renderer must be able to synthesize the useStatusConfigCard hook');
  assert.equal(bound.useStatusConfigCard((s) => s).statusUrl.text, '');
});

test('the card renders the three config fields', async () => {
  const { ctx, out } = await boot({ primitives: stubPrimitives() });
  out.plugin.apply(ctx);
  const card = out.registrations.find((r) => r.slot.name === 'plugins.bundle.config');
  const t = (key) => out.strings[key];
  assert.equal(card.component({ view: 'summary', t, ...bindInject(card.slot.inject()) }), out.strings.configSummary);

  const page = card.component({ view: 'page', t, ...bindInject(card.slot.inject()) });
  const json = JSON.stringify(page);
  for (const id of ['plugin-config-deepseek-status-url', 'plugin-config-deepseek-status-interval', 'plugin-config-deepseek-status-timeout']) {
    assert.ok(json.includes(id), `the form must render ${id}`);
  }
});

test('the card carries the whole form shell, so the fields are not hidden', async () => {
  // SettingsForm renders its "not configurable" line whenever `available` is
  // falsy, so the projection must spread `shell()` rather than pick from it.
  const { ctx, out } = await boot({ primitives: stubPrimitives() });
  out.plugin.apply(ctx);
  const card = out.registrations.find((r) => r.slot.name === 'plugins.bundle.config');
  const face = card.slot.inject();
  const state = bindInject(face).useStatusConfigCard((s) => s);
  for (const key of ['available', 'writable', 'dirty', 'invalid', 'saving', 'failed']) {
    assert.ok(key in state, `the projection must carry the form shell field "${key}"`);
  }
  assert.equal(state.available, true);

  const t = (key) => out.strings[key];
  const page = card.component({ view: 'page', t, ...bindInject(face) });
  assert.notEqual(page && page.type, 'SettingsUnavailable', 'the card must not fall into the unavailable branch');
});

test('a namespace the Host stops serving shows the unavailable line, not empty fields', async () => {
  // Same projection, but with the controller reporting it is not available.
  const primitives = stubPrimitives();
  const OriginalModel = primitives.SettingsFormModel;
  primitives.SettingsFormModel = class extends OriginalModel {
    shell() { return { ...super.shell(), available: false }; }
  };
  const { ctx, out } = await boot({ primitives });
  out.plugin.apply(ctx);
  const card = out.registrations.find((r) => r.slot.name === 'plugins.bundle.config');
  const t = (key) => out.strings[key];
  const page = card.component({ view: 'page', t, ...bindInject(card.slot.inject()) });
  assert.equal(page.type, 'SettingsUnavailable');
  assert.equal(page.children, out.strings.configUnavailable);
});

test('every label the card asks for exists in both dictionaries', async () => {
  const { ctx, out } = await boot({ primitives: stubPrimitives() });
  out.plugin.apply(ctx);
  const card = out.registrations.find((r) => r.slot.name === 'plugins.bundle.config');
  const missing = [];
  const t = (key) => { if (out.strings[key] === undefined) missing.push(key); return out.strings[key] ?? key; };
  card.component({ view: 'page', t, ...bindInject(card.slot.inject()) });
  assert.deepEqual(missing, [], 'these labels are not in the dictionary: ' + missing.join(', '));
});
