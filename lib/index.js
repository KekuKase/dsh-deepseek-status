// dsh-status — host half.
//
// Polls the DeepSeek official status page (status.deepseek.com, a Flashcat
// status page) and serves the parsed snapshot over an exact route on the
// existing web server, so the browser half can read it same-origin without
// CORS. Config resolves through the settings seam (settings.yaml overrides
// and the Web settings form), falling back to the composition entry config.
import z from "@deepseek-ai/schemastery";
import { installSettingsSection } from "@deepseek-ai/dsh-settings";
import { parseStatusPage } from "./parser.js";

const name = "dsh-status";
/** The web server is a web-profile-only service; without it this fiber stays pending. */
const inject = ["webServer", "timer"];

/** Plugin config schema; defaults keep the row config optional. */
const Config = z.object({
  statusUrl: z.string().default("https://status.deepseek.com/"),
  pollIntervalMs: z.number().min(15000).max(3600000).default(60000),
  timeoutMs: z.number().min(5000).max(120000).default(15000),
});

const ROUTE_PATH = "/dsh-status/current";

const FALLBACK = {
  statusUrl: "https://status.deepseek.com/",
  pollIntervalMs: 60000,
  timeoutMs: 15000,
};

function apply(ctx, entryConfig = {}) {
  let snapshot = null; // last good snapshot
  let lastError = null;
  let timer = null;
  let source = () => entryConfig;

  const resolveConfig = () => {
    const c = source() ?? {};
    return {
      statusUrl: typeof c.statusUrl === "string" && c.statusUrl !== "" ? c.statusUrl : FALLBACK.statusUrl,
      pollIntervalMs: Number.isFinite(c.pollIntervalMs) && c.pollIntervalMs > 0 ? c.pollIntervalMs : FALLBACK.pollIntervalMs,
      timeoutMs: Number.isFinite(c.timeoutMs) && c.timeoutMs > 0 ? c.timeoutMs : FALLBACK.timeoutMs,
    };
  };

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
      ctx.logger?.warn?.(`dsh-status: refresh failed: ${lastError}`);
    }
  }

  function arm() {
    if (timer !== null) clearInterval(timer);
    timer = ctx.setInterval(() => { void refresh(); }, resolveConfig().pollIntervalMs);
  }

  // Settings seam: settings.yaml and the Web settings form override the
  // composition entry; the poller re-arms on live updates.
  installSettingsSection(ctx, "dsh-status", Config, entryConfig, {
    setSource(fn) { source = fn; },
    onChange() { arm(); },
  });
  ctx.on("settings/updated", (ns) => {
    if (ns === "dsh-status") arm();
  });

  ctx.effect(() => {
    void refresh();
    arm();
    return () => { if (timer !== null) clearInterval(timer); };
  }, "dsh-status: poller");

  ctx.effect(() => ctx.webServer.register({
    kind: "exact",
    path: ROUTE_PATH,
    handler: async (req, res) => {
      const body = snapshot !== null
        ? JSON.stringify(snapshot)
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
  }), "dsh-status: route");

  ctx.logger?.info?.(`dsh-status: polling ${resolveConfig().statusUrl} every ${resolveConfig().pollIntervalMs}ms`);
}

export { apply, Config, inject, name };
