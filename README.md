# dsh-deepseek-status

A DeepSeek Harness (DSH) plugin that shows the **live DeepSeek official service status** (status.deepseek.com) in the Web UI session header — overall status, per-component statuses, active/recent incidents, and uptime percentages.

DeepSeek Harness 插件：在 Web UI 会话头部实时显示 **DeepSeek 官方服务状态**（status.deepseek.com 同源数据）。

- 状态点 + 文字：绿=所有系统运行正常 / 蓝=维护中 / 黄=性能下降 / 橙=部分故障 / 红=严重故障 / 灰=状态未知
- 点击展开面板：总体状态、最后更新时间、各组件状态、进行中的事件/维护、最近事件、各组件可用率(uptime%)
- 宿主进程每 60s 轮询官方状态页并解析（Next.js SSR flight 数据），浏览器每 30s 拉取本地同源路由（无 CORS 问题）
- 上游故障时保留最后一次成功快照并显示「更新于 X 分钟前」，绝不显示假"正常"

## 兼容性

| 插件版本 | DSH | 说明 |
|---|---|---|
| **0.1.5** | **0.2.x** | **恢复设置界面**（两段式：宿主侧字段声明 `.volatile()`，浏览器半区注册配置卡片），保存后**无需重启**即生效。 |
| 0.1.4 | 0.2.x | 移除 DSH 0.2 已删除的设置接缝（`installSettingsSection` / `settings.installSection` / `settings/updated`），配置改由 profile patch 中该行的 `config` 提供。**注意：0.1.4 起设置界面不可见，0.1.5 才把它恢复。** |
| 0.1.2 / 0.1.3 | 0.1.x | 使用旧设置接口（`installSettingsSection` / `settings.installSection`），支持在设置里改轮询间隔并热更新。 |

**0.1.5 实测环境**：Windows + DSH **0.2.0-rc.2**（`@deepseek-ai/dsh` 0.2.0-rc.2、`@deepseek-ai/schemastery` 3.18.4）；`npm test` **17 项通过**。

- 配置变化后始终只保留**一个**轮询定时器；
- 上游不可用时，面板保留最后一次成功快照并同时提示抓取失败，绝不显示假「正常」。

⚠️ **关于 0.1.x（未核实）**：0.1.5 的浏览器半区会注入 0.2 的设置服务（`configForms`）来注册配置卡片。
若 0.1.x 的客户端没有该服务，按 Cordis 的语义整个浏览器半区会保持 pending（即状态挂件也**不会**出现）。
**这一点我没有在 0.1.x 上实测过**，所以不确定；如果你在 0.1.x 上使用，请先备份，或先用 0.1.3。
若需要 0.1.5 无条件兼容 0.1.x（最坏情况下只是不显示配置区），把该依赖改成可选注入即可。

此验证针对上述版本与场景，不代表对未来所有 DSH 版本的保证。

## 安装

```sh
# 从 npm
dsh plugin --profile web add dsh-deepseek-status

# 或从本地 checkout / tarball
dsh plugin --profile web add ./dsh-deepseek-status
dsh plugin --profile web add ./dsh-deepseek-status-0.1.5.tgz
```

安装后重启 `dsh web`（新客户端插件需要重启进程才会被扫描进浏览器清单），即可在会话头部看到状态点（点击展开详情面板）。
桌面端则是在**侧栏「插件」页**安装/查看，profile 名为 `desktop`；升级或替换已安装的插件包后同样需要**完全重启客户端**（宿主代码不会热加载）。

GitHub 源码更新与 npm 发布是独立的。若 npm 尚未提供 0.1.5，可从此仓库构建安装包：

```sh
git clone https://github.com/KekuKase/dsh-deepseek-status.git
cd dsh-deepseek-status
npm pack
dsh plugin --profile web add ./dsh-deepseek-status-0.1.5.tgz
```

`npm test` 运行回归测试；`npm pack` 会先执行语法检查和测试。
其中一项测试会用真实的 `@deepseek-ai/schemastery` 校验配置 schema——该 peer 依赖未安装时它会自动跳过（其余测试照常运行）。

## 配置

默认无需配置。三种覆盖方式（生效优先级从低到高）：

1. profile patch 覆盖本 bundle 的行：
   ```yaml
   # $DSH_HOME/profiles/web/cordis.patch.yml
   - id: deepseek-status
     config:
       pollIntervalMs: 120000
   ```
2. `$DSH_HOME/settings.yaml`（旧版 DSH 的兼容路径；DSH 0.2 起由设置表单写入 profile patch）
3. 侧栏 **插件页**（内置插件 / 已装插件）里本插件的配置区，可改上面三项并保存。

表单是**两段式**实现的，因为 DSH 0.2 **不会**按 schema 自动建表单（`autoGenerate` 只是随数据传递、没有任何客户端读它）：

- **宿主半区**把三个 `Config` 字段声明为 `.volatile()`——Host 设置服务只投影易变字段，这是表单能被 `describe()` 出来的前提；
- **浏览器半区**注册一张配置卡片，key 必须与插件页自己拼的**完全一致**：
  - `plugins.bundle.config` → `dsh-deepseek-status`（包名）
  - `plugins.row.config` → `dsh-deepseek-status#deepseek-status`（`` `${包名}#${行id}` ``）
  注册还包在 `ctx.configForms.whileServed([...])` 里，只有宿主真的提供该命名空间时才注册；两处注册都独立 try/catch，失败只记警告，绝不影响状态挂件。

保存后**无需重启**：易变字段解析成可读引用，Cordis 把「仅易变字段变化」提交进运行中的引用并广播 `loader/volatile-update`，插件据此重新挂载轮询定时器。实测：把间隔从 60000 改成 120000 并保存后，下一次抓取正好在 120 秒后发生，全程未重启。

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
