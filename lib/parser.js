// Parser for status.deepseek.com (Flashcat/FlashDuty status page).
//
// The page is a Next.js SSR app: the full state is embedded in the HTML as
// escaped flight payloads (self.__next_f.push([1,"..."])). This module
// extracts the relevant JSON regions by their field names, so it tolerates
// surrounding structural changes better than parsing one whole object.

/** Unescape one JS string literal (handles \" \\ \n and \uXXXX). */
function unescapeJsString(s) {
  return s.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (m, c) => {
    if (c[0] === "u") return String.fromCharCode(parseInt(c.slice(1), 16));
    switch (c) {
      case "n": return "\n";
      case "r": return "\r";
      case "t": return "\t";
      case "b": return "\b";
      case "f": return "\f";
      default: return c;
    }
  });
}

/** Concatenate every decoded __next_f flight payload string from the HTML. */
export function extractFlightText(html) {
  const parts = [];
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,(.*?)\]\)<\/script>/gs)) {
    let raw = m[1].trim();
    if (raw.startsWith('"') && raw.endsWith('"')) raw = raw.slice(1, -1);
    parts.push(unescapeJsString(raw));
  }
  return parts.join("\n");
}

/** Match a {…} or […] region starting at openIdx, returning the raw slice and its end. */
function matchDelimited(text, openIdx) {
  const open = text[openIdx];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === "\\") { esc = true; continue; }
      if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return { value: text.slice(openIdx, i + 1), end: i + 1 };
    }
  }
  return null;
}

/** Extract and parse the JSON value following the first occurrence of `key`. */
function extractValue(text, key) {
  const idx = text.indexOf(key);
  if (idx < 0) return null;
  let p = idx + key.length;
  while (p < text.length && /\s/.test(text[p])) p++;
  if (text[p] === "{" || text[p] === "[") {
    const region = matchDelimited(text, p);
    if (!region) return null;
    try { return JSON.parse(region.value); } catch { return null; }
  }
  if (text[p] === '"') {
    const end = text.indexOf('"', p + 1);
    return end < 0 ? null : text.slice(p + 1, end);
  }
  const scalar = /^(-?\d+(?:\.\d+)?|true|false|null)/.exec(text.slice(p));
  if (!scalar) return null;
  if (scalar[1] === "null") return null;
  if (scalar[1] === "true") return true;
  if (scalar[1] === "false") return false;
  return Number(scalar[1]);
}

const STATUS_RANK = { operational: 0, maintenance: 1, degraded: 2, partial_outage: 3, full_outage: 4 };
const TERMINAL = new Set(["resolved", "completed", "cancelled"]);

/** Build the display snapshot from the extracted regions. */
function buildSnapshot(parsed) {
  const page = parsed.page;
  const activeChanges = parsed.activeChanges;
  const changes = parsed.changes;
  const uptimes = parsed.componentUptimes;

  const components = (page?.components ?? []).map((c) => ({
    id: c.component_id ?? "",
    name: c.name ?? c.component_id ?? "",
    description: c.description ?? "",
    status: activeChanges === null ? "unknown" : "operational",
  }));
  const byId = new Map(components.map((c) => [c.id, c]));

  const active = (activeChanges ?? []).map((ch) => ({
    type: ch.type === "maintenance" ? "maintenance" : "incident",
    title: ch.title ?? "",
    status: ch.status ?? "unknown",
    startedAt: typeof ch.start_at_seconds === "number" ? ch.start_at_seconds : null,
    closedAt: typeof ch.close_at_seconds === "number" ? ch.close_at_seconds : null,
    affected: (ch.affected_components ?? []).map((a) => ({
      id: a.component_id ?? "",
      name: a.name ?? "",
      status: a.status ?? "unknown",
    })),
    latestDescription: ch.updates?.at(-1)?.description ?? ch.description ?? "",
  }));

  if (activeChanges !== null) {
    for (const ch of activeChanges ?? []) {
      const isMaintenance = ch.type === "maintenance";
      for (const a of ch.affected_components ?? []) {
        const comp = byId.get(a.component_id);
        if (!comp) continue;
        const next = isMaintenance && comp.status === "operational" ? "maintenance" : a.status;
        if ((STATUS_RANK[next] ?? 0) > (STATUS_RANK[comp.status] ?? 0)) comp.status = next;
      }
    }
  }

  let overall = activeChanges === null ? "unknown" : "operational";
  for (const c of components) {
    if ((STATUS_RANK[c.status] ?? 0) > (STATUS_RANK[overall] ?? 0)) overall = c.status;
  }

  const recentResolved = (changes ?? [])
    .filter((ch) => TERMINAL.has(ch.status))
    .slice(0, 5)
    .map((ch) => ({
      type: ch.type === "maintenance" ? "maintenance" : "incident",
      title: ch.title ?? "",
      startedAt: typeof ch.start_at_seconds === "number" ? ch.start_at_seconds : null,
      closedAt: typeof ch.close_at_seconds === "number" ? ch.close_at_seconds : null,
    }));

  const uptime = (uptimes ?? []).map((u) => ({
    id: u.component_id ?? "",
    uptime: typeof u.uptime === "number" ? u.uptime : null,
  }));

  return {
    overall,
    components,
    active,
    recentResolved,
    uptime,
    updatedAt: parsed.initialDataUpdatedAt ?? null,
  };
}

/** Parse the status page HTML into the display snapshot. Throws on failure. */
export function parseStatusPage(html) {
  const text = extractFlightText(html);
  if (!text) throw new Error("no flight payload found");
  const parsed = {
    page: extractValue(text, '"page":'),
    activeChanges: extractValue(text, '"active_changes":'),
    changes: extractValue(text, '"changes":'),
    componentUptimes: extractValue(text, '"component_uptimes":'),
    initialDataUpdatedAt: extractValue(text, '"initialDataUpdatedAt":'),
  };
  if (!parsed.page) throw new Error("page object not found");
  return buildSnapshot(parsed);
}
