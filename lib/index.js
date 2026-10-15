// dsh-deepseek-status — host half.
//
// Polls the DeepSeek official status page (status.deepseek.com, a Flashcat
// status page) and serves the parsed snapshot over an exact route on the
// existing web server, so the browser half can read it same-origin without
// CORS.
//
// Config comes from the bundle row's `config` (cordis.patch.yml), validated
// against the exported `Config` schema; a missing row config falls back to
// the defaults below.
//
// The fields are marked `.volatile()`. That is what makes the Host settings
// service project them into an editable form ("Forms expose only volatile
// fields from active, uniquely addressed profile entries"), and what keeps the
// parsed values live: Cordis commits a volatile-only config change into the
// running references without remounting, so an edit applies without a restart.
// DSH 0.2 removed the settings-seam helpers this plugin used to register with
// (`installSettingsSection` / `settings.installSection` / the
// `settings/updated` event); declaring volatile fields replaces them on the host
// side, and the browser half (lib/client.js) contributes the form itself —
// DSH 0.2 has no client that builds one from a schema.
import z from "@deepseek-ai/schemastery";
import { parseStatusPage } from "./parser.js";

const name = "dsh-deepseek-status";
/** The web server is a web-profile-only service; without it this fiber stays pending. */
const inject = ["webServer", "timer"];

/**
 * Plugin config schema; defaults keep the row config optional.
 *
 * `.volatile()` on each field is load-bearing: without it the Host projects no
 * form and the plugin's settings disappear from the UI again.
 */
const Config = z.object({
  statusUrl: z.string().default("https://status.deepseek.com/").volatile(),
  pollIntervalMs: z.number().min(15000).max(3600000).default(60000).volatile(),
  timeoutMs: z.number().min(5000).max(120000).default(15000).volatile(),
});

const ROUTE_PATH = "/deepseek-status/current";

const FALLBACK = {
  statusUrl: "https://status.deepseek.com/",
  pollIntervalMs: 60000,
  timeoutMs: 15000,
};

/**
 * Read one parsed config field.
 *
 * A volatile field parses into a stable reference whose value is read through
 * `get()`, and Cordis swaps that value in place when the profile changes. A
 * plain value — an older or non-volatile schema — is returned as-is.
 */
function readField(value) {
  return value !== null && typeof value === "object" && typeof value.get === "function"
    ? value.get()
    : value;
}

/**
 * Normalize one config object, falling back to the defaults above.
 *
 * Read on every use rather than once at activation: the volatile references are
 * the live values, so re-reading is what lets an edited interval take effect
 * without a restart.
 */
function resolveSettings(config) {
  const c = config ?? {};
  const statusUrl = readField(c.statusUrl);
  const pollIntervalMs = readField(c.pollIntervalMs);
  const timeoutMs = readField(c.timeoutMs);
  return {
    statusUrl: typeof statusUrl === "string" && statusUrl !== "" ? statusUrl : FALLBACK.statusUrl,
    pollIntervalMs: Number.isFinite(pollIntervalMs) && pollIntervalMs > 0 ? pollIntervalMs : FALLBACK.pollIntervalMs,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : FALLBACK.timeoutMs,
  };
}

function apply(ctx, entryConfig = {}) {
  let snapshot = null; // last good snapshot
  let lastError = null;
  let disposeTimer = null;
  /** Resolved per use: the row config holds the live volatile references. */
  const resolveConfig = () => resolveSettings(entryConfig);

  async function refresh() {
    const { statusUrl, timeoutMs } = resolveConfig();
    try {
      const res = await fetch(statusUrl, {
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: "text/html,application/xhtml+xml" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const data = parseStatusPage(html);
      snapshot = { ...data, fetchedAt: Date.now(), error: null };
      lastError = null;
    } catch (error) {
      lastError = String(error?.message ?? error);
      ctx.logger?.warn?.(`dsh-deepseek-status: refresh failed: ${lastError}`);
    }
  }

  function disarm() {
    if (disposeTimer !== null) disposeTimer();
    disposeTimer = null;
  }

  function arm() {
    // Cordis returns a disposer, not a native setInterval handle.
    disarm();
    disposeTimer = ctx.setInterval(() => { void refresh(); }, resolveConfig().pollIntervalMs);
  }

  // No settings seam to register: the Host reads the form off the exported
  // `Config` schema (its volatile fields), so declaring `Config` both validates
  // the row config and publishes the editable fields.
  //
  // A saved form edit is a volatile-only config change, which Cordis commits
  // into the running references and announces as `loader/volatile-update`
  // instead of remounting the fiber. Re-arming there is what makes a new
  // interval take effect without a restart; it replaces the old
  // `settingsHooks.onChange() { arm(); }`. Reading the values per use is the
  // other half, because those references are live.
  ctx.on("loader/volatile-update", () => { arm(); });

  ctx.effect(() => {
    void refresh();
    arm();
    return disarm;
  }, "dsh-deepseek-status: poller");

  ctx.effect(() => ctx.webServer.register({
    kind: "exact",
    path: ROUTE_PATH,
    handler: async (req, res) => {
      const body = snapshot !== null
        ? JSON.stringify({ ...snapshot, error: lastError })
        : JSON.stringify({
            overall: "unknown",
            components: [],
            active: [],
            recentResolved: [],
            uptime: [],
            updatedAt: null,
            fetchedAt: null,
            error: lastError ?? "no data yet",
          });
      res.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      });
      res.end(body);
    },
  }), "dsh-deepseek-status: route");

  ctx.logger?.info?.(`dsh-deepseek-status: polling ${resolveConfig().statusUrl} every ${resolveConfig().pollIntervalMs}ms`);
}

export { apply, Config, inject, name };
