/**
 * dsh-status — browser half.
 *
 * A live DeepSeek official service status widget in the sidebar footer
 * (`sidebar.footer.action` slot): a status dot + label, click to expand a
 * panel with the overall status, per-component statuses, active and recent
 * incidents, uptime percentages, and the last-updated time.
 *
 * Data comes from the host half's same-origin route `/dsh-status/current`
 * (the host polls status.deepseek.com; the browser just polls the route).
 * Hand-written ModuleLoader bundle — no build step.
 */
window.__ModuleLoader__.load({
  id: "dsh-status",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    var react = require("react");
    var h = react.createElement;

    // ── CSS ────────────────────────────────────────────────────────────────
    var CSS = ".__ds_root{display:flex;flex-direction:column;gap:6px;min-width:0}" +
      ".__ds_btn{display:inline-flex;align-items:center;gap:6px;border:none;background:0 0;color:var(--dsw-alias-label-secondary);cursor:pointer;font:inherit;font-size:12px;line-height:18px;padding:4px 6px;border-radius:6px;text-align:left;min-width:0}" +
      ".__ds_btn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}" +
      ".__ds_label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".__ds_dot{flex:none;width:8px;height:8px;border-radius:50%;display:inline-block}" +
      ".__ds_ok{background:var(--dsw-alias-state-success-primary,#22c55e)}" +
      ".__ds_maint{background:var(--dsw-alias-state-business-primary,#3b82f6)}" +
      ".__ds_degraded{background:#f59e0b}" +
      ".__ds_partial{background:#f97316}" +
      ".__ds_outage{background:var(--dsw-alias-state-error-primary,#ef4444)}" +
      ".__ds_unknown{background:var(--dsw-alias-label-tertiary,#9ca3af)}" +
      ".__ds_panel{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-2);padding:10px;display:flex;flex-direction:column;gap:10px;max-height:320px;overflow:auto;font-size:12px;line-height:18px;min-width:0;box-sizing:border-box}" +
      ".__ds_head{display:flex;align-items:center;gap:6px;color:var(--dsw-alias-label-primary);font-weight:600}" +
      ".__ds_sub{color:var(--dsw-alias-label-tertiary);font-size:11px}" +
      ".__ds_sect{color:var(--dsw-alias-label-tertiary);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px}" +
      ".__ds_row{display:flex;align-items:center;gap:6px;color:var(--dsw-alias-label-secondary)}" +
      ".__ds_rowName{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".__ds_rowVal{flex:none;color:var(--dsw-alias-label-tertiary)}" +
      ".__ds_title{color:var(--dsw-alias-label-primary)}" +
      ".__ds_desc{color:var(--dsw-alias-label-tertiary);word-break:break-word}" +
      ".__ds_link{color:var(--dsw-alias-brand-primary);text-decoration:none}" +
      ".__ds_link:hover{text-decoration:underline}" +
      ".__ds_err{color:var(--dsw-alias-label-error)}";
    var tagId = "dsh-status/main.css";
    if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
      var tag = document.createElement("style");
      tag.dataset.plugin = "dsh-status";
      tag.dataset.pluginCss = tagId;
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

    // ── locale ─────────────────────────────────────────────────────────────
    var NS = "dsh-status";
    var inject = ["slots", "locale"];
    var zh = {
      nav: "服务状态",
      operational: "所有系统运行正常",
      maintenance: "维护中",
      degraded: "性能下降",
      partialOutage: "部分故障",
      fullOutage: "严重故障",
      unknown: "状态未知",
      updated: "更新于 {time}",
      components: "组件状态",
      activeEvents: "进行中的事件",
      noActiveEvents: "当前无进行中的事件或维护",
      recentEvents: "最近事件",
      noRecentEvents: "暂无历史事件",
      uptime: "可用率",
      openPage: "打开状态页 ↗",
      fetchError: "无法获取服务状态",
      incidentStatus: { investigating: "调查中", identified: "已定位", monitoring: "监控中", resolved: "已解决", scheduled: "已计划", in_progress: "进行中", ongoing: "进行中", completed: "已完成", cancelled: "已取消" },
      justNow: "刚刚",
      minutesAgo: "{n} 分钟前",
      hoursAgo: "{n} 小时前",
      daysAgo: "{n} 天前",
      unknownTime: "未知时间"
    };
    var en = {
      nav: "Service Status",
      operational: "All Systems Operational",
      maintenance: "Under Maintenance",
      degraded: "Degraded Performance",
      partialOutage: "Partial Outage",
      fullOutage: "Full Outage",
      unknown: "Status Unavailable",
      updated: "Updated {time}",
      components: "Components",
      activeEvents: "Active Events",
      noActiveEvents: "No active incidents or maintenance",
      recentEvents: "Recent Events",
      noRecentEvents: "No recent events",
      uptime: "Uptime",
      openPage: "Open status page ↗",
      fetchError: "Unable to fetch service status",
      incidentStatus: { investigating: "Investigating", identified: "Identified", monitoring: "Monitoring", resolved: "Resolved", scheduled: "Scheduled", in_progress: "In Progress", ongoing: "In Progress", completed: "Completed", cancelled: "Cancelled" },
      justNow: "just now",
      minutesAgo: "{n} min ago",
      hoursAgo: "{n} h ago",
      daysAgo: "{n} d ago",
      unknownTime: "unknown time"
    };

    // ── status metadata ────────────────────────────────────────────────────
    var STATUS_META = {
      operational: { cls: "__ds_ok", label: "operational" },
      maintenance: { cls: "__ds_maint", label: "maintenance" },
      degraded: { cls: "__ds_degraded", label: "degraded" },
      partial_outage: { cls: "__ds_partial", label: "partialOutage" },
      full_outage: { cls: "__ds_outage", label: "fullOutage" },
      unknown: { cls: "__ds_unknown", label: "unknown" }
    };

    function metaOf(status) { return STATUS_META[status] || STATUS_META.unknown; }

    function Dot(props) {
      return h("span", { className: "__ds_dot " + metaOf(props.status).cls });
    }

    function fmtAgo(ms, t) {
      if (!ms) return t("unknownTime");
      var diff = Date.now() - ms;
      if (diff < 60000) return t("justNow");
      var minutes = Math.floor(diff / 60000);
      if (minutes < 60) return t("minutesAgo").replace("{n}", String(minutes));
      var hours = Math.floor(minutes / 60);
      if (hours < 24) return t("hoursAgo").replace("{n}", String(hours));
      return t("daysAgo").replace("{n}", String(Math.floor(hours / 24)));
    }

    function eventStatusLabel(status, t) {
      return (t("incidentStatus")[status]) || status;
    }

    // ── data hook: poll the host route ─────────────────────────────────────
    function useStatus(refreshMs) {
      var state = react.useState({ data: null, error: null });
      var s = state[0];
      var set = state[1];
      react.useEffect(function () {
        var alive = true;
        function tick() {
          fetch("/dsh-status/current", { cache: "no-store" })
            .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
            .then(function (d) { if (alive) set(function () { return { data: d, error: null }; }); })
            .catch(function (e) { if (alive) set(function (prev) { return { data: prev.data, error: String(e) }; }); });
        }
        tick();
        var timer = setInterval(tick, refreshMs);
        return function () { alive = false; clearInterval(timer); };
      }, [refreshMs]);
      return s;
    }

    // ── panel ──────────────────────────────────────────────────────────────
    function Panel(props) {
      var t = props.t;
      var data = props.data;
      var error = props.error;
      var overall = data ? data.overall : "unknown";
      var uptimeById = {};
      (data && data.uptime ? data.uptime : []).forEach(function (u) { uptimeById[u.id] = u.uptime; });
      var updatedAt = (data && (data.updatedAt || data.fetchedAt)) || null;
      return h("div", { className: "__ds_panel" },
        h("div", { className: "__ds_head" },
          h(Dot, { status: overall }),
          h("span", null, t(metaOf(overall).label)),
          h("a", { className: "__ds_link", href: "https://status.deepseek.com/", target: "_blank", rel: "noreferrer", style: { marginLeft: "auto" } }, t("openPage"))
        ),
        h("div", { className: "__ds_sub" }, t("updated").replace("{time}", fmtAgo(updatedAt, t))),
        error && !data ? h("div", { className: "__ds_err" }, t("fetchError")) : null,
        h("div", { className: "__ds_sect" }, t("components")),
        (data && data.components ? data.components : []).map(function (c) {
          return h("div", { className: "__ds_row", key: c.id || c.name },
            h(Dot, { status: c.status }),
            h("span", { className: "__ds_rowName", title: c.name }, c.name),
            uptimeById[c.id] !== undefined ? h("span", { className: "__ds_rowVal" }, uptimeById[c.id].toFixed(2) + "%") : null
          );
        }),
        h("div", { className: "__ds_sect" }, t("activeEvents")),
        !data || !data.active || data.active.length === 0
          ? h("div", { className: "__ds_sub" }, t("noActiveEvents"))
          : (data.active || []).map(function (ev, i) {
              return h("div", { key: "a" + i },
                h("div", { className: "__ds_title" }, (ev.type === "maintenance" ? "🔧 " : "⚠ ") + ev.title),
                h("div", { className: "__ds_sub" }, eventStatusLabel(ev.status, t) + (ev.startedAt ? " · " + fmtAgo(ev.startedAt * 1000, t) : ""))
              );
            }),
        h("div", { className: "__ds_sect" }, t("recentEvents")),
        !data || !data.recentResolved || data.recentResolved.length === 0
          ? h("div", { className: "__ds_sub" }, t("noRecentEvents"))
          : (data.recentResolved || []).map(function (ev, i) {
              return h("div", { key: "r" + i },
                h("div", { className: "__ds_title" }, (ev.type === "maintenance" ? "🔧 " : "⚠ ") + ev.title),
                h("div", { className: "__ds_sub" }, t("incidentStatus").resolved + (ev.closedAt ? " · " + fmtAgo(ev.closedAt * 1000, t) : ""))
              );
            })
      );
    }

    // ── widget ─────────────────────────────────────────────────────────────
    function StatusWidget(props) {
      var t = props.t;
      var status = useStatus(30000);
      var open = react.useState(false);
      var openV = open[0];
      var setOpen = open[1];
      var data = status.data;
      var overall = data ? data.overall : "unknown";
      var label = data ? t(metaOf(overall).label) : t("unknown");
      var wide = props.wide !== false;
      return h("div", { className: "__ds_root" },
        openV ? h(Panel, { t: t, data: data, error: status.error }) : null,
        h("button", {
          type: "button",
          className: "__ds_btn",
          title: t("nav"),
          onClick: function () { setOpen(!openV); }
        },
          h(Dot, { status: overall }),
          wide ? h("span", { className: "__ds_label" }, label) : null
        )
      );
    }

    // ── plugin ─────────────────────────────────────────────────────────────
    function apply(ctx) {
      var t = ctx.locale.bind(NS);
      ctx.effect(function () { return ctx.locale.register(NS, { zh: zh, en: en }); }, "dsh-status: dictionaries");
      ctx.slots.inject("sidebar.footer.action", function () {
        return ctx.slots.register({
          name: "sidebar.footer.action",
          id: "dsh-status",
          locale: NS
        }, StatusWidget);
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
