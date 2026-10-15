// dsh-deepseek-status — host half.
//
// Polls the DeepSeek official status page (status.deepseek.com, a Flashcat
// status page) and serves the parsed snapshot over an exact route on the
// existing web server, so the browser half can read it same-origin without
// CORS.
//
// Config comes from the bundle row's `config` (cordis.patch.yml), validated
// against the exported `Config` schema; a missing row config falls back to
// the defaults below. DSH 0.2 removed the settings-seam helpers this plugin
// used to register with (`installSettingsSection` / `settings.installSection`
// / the `settings/updated` event), and the current Host plugin contract
// resolves config once at activation, so the overrides live in the row config
// and in `settings.yaml` rather than in a settings form.
import z from "@deepseek-ai/schemastery";
import { parseStatusPage } from "./parser.js";

const name = "dsh-deepseek-status";
/** The web server is a web-profile-only service; without it this fiber stays pending. */
const inject = ["webServer", "timer"];

/** Plugin config schema; defaults keep the row config optional. */
const Config = z.object({
  statusUrl: z.string().default("https://status.deepseek.com/"),
  pollIntervalMs: z.number().min(15000).max(3600000).default(60000),
  timeoutMs: z.number().min(5000).max(120000).default(15000),
});

const ROUTE_PATH = "/deepseek-status/current";

const FALLBACK = {
  statusUrl: "https://status.deepseek.com/",
  pollIntervalMs: 60000,
  timeoutMs: 15000,
};

/** Normalize one config object, falling back to the defaults above. */
function resolveSettings(config) {
  const c = config ?? {};
  return {
    statusUrl: typeof c.statusUrl === "string" && c.statusUrl !== "" ? c.statusUrl : FALLBACK.statusUrl,
    pollIntervalMs: Number.isFinite(c.pollIntervalMs) && c.pollIntervalMs > 0 ? c.pollIntervalMs : FALLBACK.pollIntervalMs,
    timeoutMs: Number.isFinite(c.timeoutMs) && c.timeoutMs > 0 ? c.timeoutMs : FALLBACK.timeoutMs,
  };
}

function apply(ctx, entryConfig = {}) {
  let snapshot = null; // last good snapshot
  let lastError = null;
  let disposeTimer = null;
  /** Resolved once per activation: the row config is the only config source. */
  const settings = resolveSettings(entryConfig);

  const resolveConfig = () => settings;

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

  // No settings seam: DSH 0.2 exposes no host-side settings registration and
  // the Host plugin contract resolves `config` once, when the row activates.
  // Declaring `Config` keeps that row config validated.

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
