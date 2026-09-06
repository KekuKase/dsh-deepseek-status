# Changelog

## 0.1.3

- Support the settings provider API in DSH 0.1.2 while retaining the legacy settings helper.
- Dispose Cordis timers correctly when settings change or the plugin unloads.
- Preserve the last successful status snapshot while reporting upstream refresh failures in the panel.
- Handle unavailable uptime values without crashing the panel.
- Add regression tests for both settings API shapes, deferred settings availability, polling cleanup, stale snapshots, and the session-header widget.

Version 0.1.2 was used locally to test the initial settings compatibility fix.
