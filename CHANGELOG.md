# Changelog

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
