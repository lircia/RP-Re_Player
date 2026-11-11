# Re Player Local

面向局域网访问的本地版本，使用 HTTP 运行。本分支不包含 Cloudflare 部署说明。

## 环境要求

- Node.js 22 或更新版本
- npm

## 启动

```bash
npm install
```

Windows 运行 `Local.cmd`；Linux 运行：

```bash
npm run local
```

默认监听 `http://127.0.0.1:12067`。默认管理员密码为 `masteradmin`，打开 `/admin` 登录；在 `.env` 中设置 `P` 可修改密码。

## 局域网访问

Windows 下编辑 `Local.cmd` 中的绑定地址：

```bat
set "IP=127.0.0.1"
```

例如改为 `set "IP=192.168.1.20"`，并将示例替换为运行电脑实际的局域网 IPv4 地址。启动后，局域网内其他设备访问 `http://192.168.1.20:12067`。

Linux 下可先构建，再将局域网 IP 传给启动脚本：

```bash
npm run build
node scripts/local.mjs 192.168.1.20
```

将示例 IP 替换为运行电脑实际的局域网地址。请在电脑防火墙中允许 Node.js 在专用网络通信。本机媒体文件以及使用本机路径的 `VP`/`AP` 背景图共用 TCP 端口 `12068`，该端口也需放行。

请使用分配给本机的 IPv4 地址；运行期间该地址需保持不变。本地服务使用 HTTP，不使用自签名证书。

## 配置

在管理后台挂载文件时，可在媒体链接栏填写本机绝对路径，例如 `S:\RP-Local\media\rein.mp4`。文件从运行 Re Player 的电脑读取，并通过字节范围请求流式传输；该电脑和文件在播放期间必须保持可用。此功能仅限 Local 版本，HTTP(S) 媒体链接仍可照常使用。

挂载本机文件夹时，勾选“挂载本地文件夹”，在媒体链接栏填入文件夹绝对路径，并设置网页中的挂载目录名。“下级目录访问”默认不勾选；勾选后会递归导入所有下级目录中的文件，并保留目录结构。文件类型会按扩展名自动识别。挂载信息保存在项目内的 `.local-data/wrangler`，不要删除该目录；备份时请先停止 Local 服务，再复制该目录。

将 `.env.example` 复制为 `.env`，按需填写变量。`RP_HTTP_PORT` 可修改默认网页端口 `12067`。`VP` 和 `AP` 支持图片 URL 或本机绝对路径；`VPS` 和 `APS` 控制图片不透明度。本地辅助服务会将配置的本机背景图提供给局域网客户端。

项目源代码采用 MIT 许可证。第三方组件遵循各自许可证，详见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。
