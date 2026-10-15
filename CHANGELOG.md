# Changelog

## 0.1.5

- Restore the plugin's settings in the UI, as a two-part fix. 0.1.4 removed the settings seam DSH 0.2
  deleted, but the configuration then had no way back into the interface.
- Host half: the three `Config` fields are now declared `.volatile()`, the condition the Host settings
  service uses to project an entry into a form ("Forms expose only volatile fields from active,
  uniquely addressed profile entries"), and what keeps the parsed values live. A volatile field
  parses into a stable reference read through `get()`, so `readField()` unwraps it and
  `resolveSettings()` runs per use instead of once at activation. A `loader/volatile-update`
  subscription re-arms the poller, which is what makes a saved edit apply without a restart (it
  replaces the old `settingsHooks.onChange() { arm(); }`). Plain, non-volatile config values still
  work.
- Browser half: contributes the settings card the Plugins page renders. No client builds a form from
  the schema - `autoGenerate` is carried but never read, and every official settings page ships a
  companion card - so this half registers one under the exact keys that page looks up
  (`plugins.bundle.config` by package name, `plugins.row.config` by `` `${package}#${rowId}` ``),
  backed by `SettingsFormModel` over the `deepseek-status` namespace, with a field each for the status
  URL, the poll interval and the fetch timeout. Registration is gated on
  `ctx.configForms.whileServed([...])` and caught per slot: a settings card must never take the status
  widget down with it.
- Tests: 8 → 17. Host: volatile references read through `get()`, re-arming on
  `loader/volatile-update`, and - over the real `@deepseek-ai/schemastery` - that every field stays
  volatile and that `simplify()` unwraps the references for persistence. Browser: the card registers
  under the literal keys, carries the whole form shell (a missing `available` hides every field behind
  the "not configurable" line), renders all three fields, shows the unavailable line instead of empty
  fields when the namespace stops being served, reports a missing primitives module or settings
  service rather than throwing, and uses only labels that exist in both dictionaries. The schema guard
  skips itself when the peer dependency is absent, so a bare checkout still runs the rest of the
  suite.
- README: the settings page is documented as the third override path, with the exact slot keys and
  the no-restart behaviour.

## 0.1.4

- Fix the host half failing to register its settings on DSH 0.2. DSH 0.2 no longer provides the
  settings-seam helpers this plugin used (`installSettingsSection`, `settings.installSection`) or
  the `settings/updated` event, so the registration silently did nothing and the plugin's
  configuration never appeared anywhere. The host half no longer imports
  `@deepseek-ai/dsh-settings` and no longer injects a settings service.
- Configuration now comes from the bundle row's `config` (`cordis.patch.yml`) only, validated
  against the exported `Config` schema, with the documented defaults applied when the row has no
  config. Changing it takes effect on restart, which matches the current Host plugin contract
  (config is resolved once at activation).
- Drop `@deepseek-ai/dsh-settings` from `peerDependencies`: nothing imports it any more.
- Rework the host tests: they now pin the missing config fallbacks, the single-poller lifecycle,
  and the absence of any settings dependency. A guard in the test harness makes the old code fail
  the suite, so the regression cannot come back unnoticed.

## 0.1.3

- Support the settings provider API in DSH 0.1.2 while retaining the legacy settings helper.
- Dispose Cordis timers correctly when settings change or the plugin unloads.
- Preserve the last successful status snapshot while reporting upstream refresh failures in the panel.
- Handle unavailable uptime values without crashing the panel.
- Add regression tests for both settings API shapes, deferred settings availability, polling cleanup, stale snapshots, and the session-header widget.

Version 0.1.2 was used locally to test the initial settings compatibility fix.
