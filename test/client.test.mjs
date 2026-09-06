import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { setImmediate } from 'node:timers/promises';

test('the current header slot renders stale data and a missing uptime without crashing', async () => {
  let plugin, widget, strings, cursor = 0;
  const state = [], effects = [];
  const data = { overall: 'operational', components: [{id:'api',name:'API',status:'operational'}], uptime: [{id:'api',uptime:null}], active: [], recentResolved: [], fetchedAt: 123, error: 'upstream unavailable' };
  const react = {
    createElement(type, props, ...children) { return typeof type === 'function' ? type({ ...props, children }) : { type, props, children }; },
    useState(initial) { const key = cursor++; if (!(key in state)) state[key] = initial; return [state[key], value => { state[key] = typeof value === 'function' ? value(state[key]) : value; }]; },
    useRef() { return {current:null}; },
    useEffect(callback) { effects.push(callback); },
  };
  const context = vm.createContext({
    window: { __ModuleLoader__: { load(definition) { plugin = definition.factory(name => { assert.equal(name, 'react'); return react; }); } } },
    fetch: async () => ({ok:true,json:async()=>data}),
    setInterval: () => 1,
    clearInterval() {},
  });
  vm.runInContext(await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'), context);
  plugin.apply({
    locale: { bind: () => key => strings[key], register(ns, locales) { strings = locales.zh; return () => {}; } },
    effect: callback => callback(),
    slots: {
      inject(name, callback) { assert.equal(name, 'conversation.session.header.utilities'); callback(); },
      register(slot, component) { assert.equal(slot.id, 'deepseek-status'); widget = component; },
    },
  });
  widget({t:key=>strings[key]});
  const dispose = effects[0](); // Run the real local-route fetch effect.
  await setImmediate();
  assert.equal(state[0].error, 'upstream unavailable');
  state[1] = true; // Open the status panel.
  cursor = 0;
  const rendered = widget({t:key=>strings[key]});
  const text = JSON.stringify(rendered);
  assert.ok(text.includes(strings.fetchError));
  assert.ok(text.includes('API'));
  assert.ok(!text.includes('null%'));
  dispose();
});
