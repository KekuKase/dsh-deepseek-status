# dsh-deepseek-status

A DeepSeek Harness (DSH) plugin that shows the **live DeepSeek official service status** (status.deepseek.com) in the Web UI session header — overall status, per-component statuses, active/recent incidents, and uptime percentages.

DeepSeek Harness 插件：在 Web UI 会话头部实时显示 **DeepSeek 官方服务状态**（status.deepseek.com 同源数据）。

- 状态点 + 文字：绿=所有系统运行正常 / 蓝=维护中 / 黄=性能下降 / 橙=部分故障 / 红=严重故障 / 灰=状态未知
- 点击展开面板：总体状态、最后更新时间、各组件状态、进行中的事件/维护、最近事件、各组件可用率(uptime%)
- 宿主进程每 60s 轮询官方状态页并解析（Next.js SSR flight 数据），浏览器每 30s 拉取本地同源路由（无 CORS 问题）
- 上游故障时保留最后一次成功快照并显示「更新于 X 分钟前」，绝不显示假"正常"

## 安装

```sh
# 从 npm
dsh plugin --profile web add dsh-deepseek-status

# 或从本地 checkout / tarball
dsh plugin --profile web add ./dsh-deepseek-status
dsh plugin --profile web add ./dsh-deepseek-status-0.1.0.tgz
```

安装后重启 `dsh web`（新客户端插件需要重启进程才会被扫描进浏览器清单），即可在会话头部看到状态点（点击展开详情面板）。

## 配置

默认无需配置。三种覆盖方式（生效优先级从低到高）：

1. profile patch 覆盖本 bundle 的行：
   ```yaml
   # $DSH_HOME/profiles/web/cordis.patch.yml
   - id: deepseek-status
     config:
       pollIntervalMs: 120000
   ```
2. `$DSH_HOME/settings.yaml`（热更新）：
   ```yaml
   deepseek-status:
     pollIntervalMs: 120000
   ```
3. Web 设置页「插件」卡片（安装本插件后自动出现 `deepseek-status` 配置区）。

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `statusUrl` | `https://status.deepseek.com/` | 状态页地址（可换其它 Flashcat 状态页） |
| `pollIntervalMs` | `60000` | 上游轮询间隔（毫秒，15000–3600000） |
| `timeoutMs` | `15000` | 单次抓取超时（毫秒，5000–120000） |

## 数据源与机制

- 官方页面 `https://status.deepseek.com/` 由 Flashcat(FlashDuty) 托管，是 Next.js SSR 页面；全部状态数据内嵌在首页 HTML 的 flight 负载中，插件在宿主侧抓取并容错解析（按字段名定位 JSON 区域，解析失败回退并保留上次成功快照）。
- 轮询是外部状态数据的固有形态（官方页面自身也是轮询/重试）。
- 非 web profile 下宿主行因缺少 `webServer` 服务保持 pending，无副作用。

## 卸载

```sh
dsh plugin --profile web remove dsh-deepseek-status
```

## License

MIT
