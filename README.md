<!-- IP.NodeCloak fork overview, local development and attribution. -->
# IP.NodeCloak · NodeCloak

[ip.nodecloak.com](https://ip.nodecloak.com) · [GitHub](https://github.com/nodecloak/hoplens)

IP.NodeCloak 是 NodeCloak 的 IP 与网络诊断工具，基于 [Jason Ng / MyIP](https://github.com/jason5ng32/MyIP) 的 MIT 开源项目构建，界面采用 IP.NodeCloak 视觉设计。

- 多来源公网 IPv4 / IPv6、位置与网络信息对照。
- WebRTC、DNS、网站连通性检测和手动测速。
- DNS 查询、Whois、全球延迟与 MTR、MAC 查询、IP 计算器、浏览器信息、安全清单与服务状态。
- 诊断报告复制与 JSON 导出、IP 隐私遮罩、浏览器本地历史记录。
- 深色 / 浅色主题、移动端布局、六种完整语言。

检测结果来自实际请求。未执行或失败的项目显示对应状态；检测覆盖率表示已完成项目数。各外部服务的可用性会影响结果。需要单独 API 密钥或上游专属服务的功能沿用原项目的配置开关。

## Development

Use Node 24.15+ and the pinned pnpm version:

```sh
corepack pnpm install --frozen-lockfile
cp .env.example .env
corepack pnpm dev
corepack pnpm check
```

For this deployment, set `VITE_SITE_URL=https://ip.nodecloak.com`, `BACKEND_HOST=127.0.0.1`, `BACKEND_PORT=11967`, and `ALLOWED_DOMAINS=ip.nodecloak.com,localhost,127.0.0.1`. No analytics, account, telemetry or report-storage credentials are required for the basic tools. Tests that contact external providers run from the browser or the API as appropriate; speed tests start explicitly.

Production deployment, trusted proxy headers, persistent datasets and rollback: [operations runbook](ops/README.md).

## Attribution

IP.NodeCloak is a maintained fork of **MyIP / IPCheck.ing**, by **Jason Ng and contributors**. The original MIT license remains in [LICENSE](LICENSE). Original project documentation is retained in [README.upstream.md](README.upstream.md) and the upstream language READMEs; those describe the original deployment. Geist fonts retain their SIL Open Font License in `public/fonts/LICENSE-Geist.txt`. IP.NodeCloak visual assets were supplied for this project.
