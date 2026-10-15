/**
 * dsh-deepseek-status — browser half.
 *
 * A live DeepSeek official service status widget in the session header
 * (`conversation.session.header.utilities` slot): a status dot + label, click to expand a
 * panel with the overall status, per-component statuses, active and recent
 * incidents, uptime percentages, and the last-updated time.
 *
 * Data comes from the host half's same-origin route
 * `/deepseek-status/current` (the host polls status.deepseek.com; the
 * browser just polls the route).
 * Hand-written ModuleLoader bundle — no build step.
 */
window.__ModuleLoader__.load({
  id: "dsh-deepseek-status",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    var react = require("react");
    // Guarded: the shared UI primitives carry the settings form. Without them
    // the status widget must still work, so a miss is reported, not thrown.
    var primitives;
    try {
      primitives = require("@deepseek-ai/dsh-client-ui-primitives");
    } catch (error) {
      primitives = undefined;
    }
    var h = react.createElement;

    // ── CSS ────────────────────────────────────────────────────────────────
    var CSS = ".__ds_root{position:relative;display:inline-flex;align-items:center;min-width:0}" +
      ".__ds_btn{min-height:28px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:0;border-radius:6px;align-items:center;gap:6px;padding:3px 6px;font-size:12px;line-height:18px;display:inline-flex}" +
      ".__ds_btn:hover{color:var(--dsw-alias-label-secondary)}" +
      ".__ds_label{white-space:nowrap}" +
      ".__ds_dot{flex:none;width:8px;height:8px;border-radius:50%;display:inline-block}" +
      ".__ds_ok{background:var(--dsw-alias-state-success-primary,#22c55e)}" +
      ".__ds_maint{background:var(--dsw-alias-state-business-primary,#3b82f6)}" +
      ".__ds_degraded{background:#f59e0b}" +
      ".__ds_partial{background:#f97316}" +
      ".__ds_outage{background:var(--dsw-alias-state-error-primary,#ef4444)}" +
      ".__ds_unknown{background:var(--dsw-alias-label-tertiary,#9ca3af)}" +
      ".__ds_panel{position:absolute;top:calc(100% + 6px);right:0;z-index:100;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-2));width:340px;max-width:min(400px,100vw - 32px);max-height:min(460px,100vh - 160px);box-shadow:var(--dsw-shadow-lv3);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:10px;overflow:auto;font-size:12px;line-height:18px;min-width:0}" +
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
    var tagId = "dsh-deepseek-status/main.css";
    if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
      var tag = document.createElement("style");
      tag.dataset.plugin = "dsh-deepseek-status";
      tag.dataset.pluginCss = tagId;
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

    // ── locale ─────────────────────────────────────────────────────────────
    var NS = "deepseek-status";
    var inject = ["slots", "locale", "configForms"];
    var zh = {
      nav: "服务状态",
      operational: "所有系统运行正常",
      maintenance: "维护中",
      degraded: "性能下降",
      partialOutage: "部分故障",
      fullOutage: "严重故障",
      unknown: "状态未知",
      shortOperational: "正常",
      shortMaintenance: "维护中",
      shortDegraded: "降级",
      shortPartialOutage: "部分故障",
      shortFullOutage: "严重故障",
      shortUnknown: "状态未知",
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
      unknownTime: "未知时间",
      configSummary: "状态页地址与轮询间隔，可在设置里随时修改，改完立即生效。",
      configUrl: "状态页地址",
      configUrlHint: "默认 https://status.deepseek.com/，也可换成其它 Flashcat 状态页。",
      configInterval: "轮询间隔（毫秒）",
      configIntervalHint: "宿主抓取上游状态页的频率，15000–3600000。",
      configTimeout: "抓取超时（毫秒）",
      configTimeoutHint: "单次抓取的超时时间，5000–120000。",
      overridden: "已覆盖",
      reset: "恢复默认",
      invalidNumber: "请填数字；留空表示使用默认值。",
      configUnavailable: "该插件当前未加载，暂时无法配置。",
      configReadOnly: "本部署的设置为只读。",
      configSaveFailed: "本部署没有接受这些值，已保留供你修改。",
      configSave: "保存",
      configSaving: "保存中…"
    };
    var en = {
      nav: "Service Status",
      operational: "All Systems Operational",
      maintenance: "Under Maintenance",
      degraded: "Degraded Performance",
      partialOutage: "Partial Outage",
      fullOutage: "Full Outage",
      unknown: "Status Unavailable",
      shortOperational: "Operational",
      shortMaintenance: "Maintenance",
      shortDegraded: "Degraded",
      shortPartialOutage: "Partial Outage",
      shortFullOutage: "Full Outage",
      shortUnknown: "Unavailable",
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
      unknownTime: "unknown time",
      configSummary: "Status page address and poll interval; change them in Settings and they apply at once.",
      configUrl: "Status page address",
      configUrlHint: "Defaults to https://status.deepseek.com/; any other Flashcat status page works too.",
      configInterval: "Poll interval (ms)",
      configIntervalHint: "How often the host fetches the upstream status page, 15000–3600000.",
      configTimeout: "Fetch timeout (ms)",
      configTimeoutHint: "Timeout for one fetch, 5000–120000.",
      overridden: "Overridden",
      reset: "Reset to default",
      invalidNumber: "Enter a number, or leave blank to use the default.",
      configUnavailable: "This plugin is not loaded, so it cannot be configured right now.",
      configReadOnly: "This deployment stores settings read-only.",
      configSaveFailed: "The deployment did not accept these values; they were left for you to correct.",
      configSave: "Save",
      configSaving: "Saving…"
    };

    // ── status metadata ────────────────────────────────────────────────────
    var STATUS_META = {
      operational: { cls: "__ds_ok", label: "operational", short: "shortOperational" },
      maintenance: { cls: "__ds_maint", label: "maintenance", short: "shortMaintenance" },
      degraded: { cls: "__ds_degraded", label: "degraded", short: "shortDegraded" },
      partial_outage: { cls: "__ds_partial", label: "partialOutage", short: "shortPartialOutage" },
      full_outage: { cls: "__ds_outage", label: "fullOutage", short: "shortFullOutage" },
      unknown: { cls: "__ds_unknown", label: "unknown", short: "shortUnknown" }
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
          fetch("/deepseek-status/current", { cache: "no-store" })
            .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
            .then(function (d) { if (alive) set(function () { return { data: d, error: d.error || null }; }); })
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
        error ? h("div", { className: "__ds_err" }, t("fetchError")) : null,
        h("div", { className: "__ds_sect" }, t("components")),
        (data && data.components ? data.components : []).map(function (c) {
          return h("div", { className: "__ds_row", key: c.id || c.name },
            h(Dot, { status: c.status }),
            h("span", { className: "__ds_rowName", title: c.name }, c.name),
            Number.isFinite(uptimeById[c.id]) ? h("span", { className: "__ds_rowVal" }, uptimeById[c.id].toFixed(2) + "%") : null
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
      var rootRef = react.useRef(null);
      var data = status.data;
      var overall = data ? data.overall : "unknown";
      var meta = metaOf(overall);
      var label = data ? t(meta.short) : t("shortUnknown");
      react.useEffect(function () {
        if (!openV) return;
        function onDown(e) {
          if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener("mousedown", onDown);
        return function () { document.removeEventListener("mousedown", onDown); };
      }, [openV]);
      return h("div", { className: "__ds_root", ref: rootRef },
        h("button", {
          type: "button",
          className: "__ds_btn",
          title: t("nav"),
          onClick: function () { setOpen(!openV); }
        },
          h(Dot, { status: overall }),
          h("span", { className: "__ds_label" }, label)
        ),
        openV ? h(Panel, { t: t, data: data, error: status.error }) : null
      );
    }

    // ── settings form ──────────────────────────────────────────────────────
    // The Plugins page renders no schema-driven form of its own: `autoGenerate`
    // is carried but never read, and every official page ships a companion card
    // that registers into one of the page's slots. So the host half publishes
    // the editable fields (they are `.volatile()`) and this half contributes
    // the card. The namespace is the profile entry id, `deepseek-status`.
    //
    // Registration is guarded and attempted in more than one slot: the slots
    // are `keyed`, and a miss must not take the status widget down with it.
    function StatusConfigCard(props) {
      var p = props;
      var state = p.useStatusConfigCard(function (s) { return s; });
      if (p.view === "summary") return p.t("configSummary");
      var d = primitives ? primitives : {};
      var SettingsForm = d.SettingsForm;
      var SettingsValueField = d.SettingsValueField;
      if (SettingsForm === undefined || SettingsValueField === undefined) return null;
      var labels = {
        unavailable: p.t("configUnavailable"),
        readOnly: p.t("configReadOnly"),
        saveFailed: p.t("configSaveFailed"),
        save: p.t("configSave"),
        saving: p.t("configSaving")
      };
      function valueField(id, field, label, hint, numeric, edit, reset) {
        var value = state[field] ? state[field] : { text: "", overridden: false, invalid: false };
        return h(SettingsValueField, {
          id: id,
          key: field,
          label: label,
          hint: hint,
          overriddenLabel: p.t("overridden"),
          resetLabel: p.t("reset"),
          invalidLabel: p.t("invalidNumber"),
          numeric: numeric === true,
          disabled: state.writable === false,
          text: value.text,
          overridden: value.overridden,
          invalid: value.invalid,
          onEdit: edit,
          onReset: reset
        });
      }
      return h(SettingsForm, {
        labels: labels,
        state: state,
        onSave: p.save,
        onDiscard: p.discard
      },
        valueField("plugin-config-deepseek-status-url", "statusUrl", p.t("configUrl"), p.t("configUrlHint"), false,
          function (text) { p.edit("statusUrl", text); },
          function () { p.resetField("statusUrl"); }),
        valueField("plugin-config-deepseek-status-interval", "pollIntervalMs", p.t("configInterval"), p.t("configIntervalHint"), true,
          function (text) { p.edit("pollIntervalMs", text); },
          function () { p.resetField("pollIntervalMs"); }),
        valueField("plugin-config-deepseek-status-timeout", "timeoutMs", p.t("configTimeout"), p.t("configTimeoutHint"), true,
          function (text) { p.edit("timeoutMs", text); },
          function () { p.resetField("timeoutMs"); })
      );
    }

    function makeConfigCard(ctx) {
      var d = primitives ? primitives : {};
      var SettingsFormModel = d.SettingsFormModel;
      var settingsTextField = d.settingsTextField;
      var settingsNumberField = d.settingsNumberField;
      if (SettingsFormModel === undefined || settingsTextField === undefined || settingsNumberField === undefined) {
        return undefined;
      }
      var scope = ctx.configForms.get(NS);
      var form = new SettingsFormModel(scope, [
        settingsTextField("statusUrl"),
        settingsNumberField("pollIntervalMs"),
        settingsNumberField("timeoutMs")
      ]);
      var store = form.bind(function () {
        // The shared form state MUST come first and intact: `SettingsForm`
        // renders the "not configurable" line whenever `state.available` is
        // falsy, and gates Save on `dirty`/`invalid`/`saving`. Picking only
        // `writable` out of `shell()` leaves `available` undefined, which reads
        // as "the Host is not serving this namespace" and hides the fields.
        return {
          ...form.shell(),
          statusUrl: form.field("statusUrl"),
          pollIntervalMs: form.field("pollIntervalMs"),
          timeoutMs: form.field("timeoutMs")
        };
      });
      var actions = form.actions();
      return {
        dispose: function () { form.dispose(); },
        face: function () {
          // The slot renderer turns `hooks: { statusConfigCard }` into the
          // `useStatusConfigCard` prop (dsh-client-ui-renderer's
          // `bindInjectSources`), which is how the card subscribes and
          // re-renders. The store itself is a bare observable
          // (getSnapshot/subscribe/set) and exposes no hook of its own, so it
          // must be handed over here rather than bridged by hand.
          return {
            hooks: { statusConfigCard: store },
            edit: actions.edit,
            resetField: actions.resetField,
            save: actions.save,
            discard: actions.discard
          };
        }
      };
    }

    function applyConfigCard(ctx, card, t) {
      // The Plugins page looks these up by exact key, so both spellings matter:
      //   plugins.bundle.config -> entryKey = pkg.name                (PackageDetail)
      //   plugins.row.config    -> entryKey = `${pkg.name}#${rowId}`  (RowDetail, via
      //                            the page's own `rowConfigKey`)
      // `plugins.item` is a *list* slot keyed by `id` (one card per plugin, not a
      // configuration surface), so this card does not belong there.
      var attempts = [
        { name: "plugins.bundle.config", key: "dsh-deepseek-status", order: 40 },
        { name: "plugins.row.config", key: "dsh-deepseek-status#" + NS, order: 40 }
      ];
      var disposers = [];
      for (var i = 0; i < attempts.length; i++) {
        (function (attempt) {
          try {
            disposers.push(ctx.slots.register({
              name: attempt.name,
              key: attempt.key,
              order: attempt.order,
              label: function () { return t("nav"); },
              locale: NS,
              inject: function () { return card.face(); }
            }, StatusConfigCard));
          } catch (error) {
            if (ctx.logger && ctx.logger.warn) {
              ctx.logger.warn("dsh-deepseek-status: settings card not registered in " +
                attempt.name + " (key " + attempt.key + "): " + (error && error.message ? error.message : error));
            }
          }
        })(attempts[i]);
      }
      return function () {
        for (var j = 0; j < disposers.length; j++) disposers[j]();
      };
    }

    // ── plugin ─────────────────────────────────────────────────────────────
    function apply(ctx) {
      var t = ctx.locale.bind(NS);
      ctx.effect(function () { return ctx.locale.register(NS, { zh: zh, en: en }); }, "dsh-deepseek-status: dictionaries");
      try {
        var card = makeConfigCard(ctx);
        if (card !== undefined) {
          ctx.effect(function () {
            // Register only while the Host actually serves this namespace, which
            // is what the official pages do. The page also gates the config
            // section on its own ledger, so a card registered too early would be
            // rendered as soon as either side is missing.
            var offCard = function () { return function () {}; };
            var offServed = ctx.configForms.whileServed([NS], function () {
              offCard = applyConfigCard(ctx, card, t);
              return function () { offCard(); };
            });
            return function () { offServed(); card.dispose(); };
          }, "dsh-deepseek-status: settings card");
        } else if (ctx.logger && ctx.logger.warn) {
          ctx.logger.warn("dsh-deepseek-status: settings primitives unavailable; no settings card");
        }
      } catch (error) {
        // A settings card is a nice-to-have; the status widget must survive it.
        if (ctx.logger && ctx.logger.warn) {
          ctx.logger.warn("dsh-deepseek-status: settings card failed: " + (error && error.message ? error.message : error));
        }
      }
      ctx.slots.inject("conversation.session.header.utilities", function () {
        return ctx.slots.register({
          name: "conversation.session.header.utilities",
          id: "deepseek-status",
          order: 30,
          locale: NS
        }, StatusWidget);
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
