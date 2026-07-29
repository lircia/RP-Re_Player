# Re Player (RP)

[English](README.md) | 简体中文

Re Player 是一个使用 Astro 框架、可部署到 Cloudflare Workers 的链接媒体库。访客在左侧浏览虚拟 `/root` 目录，在右侧网页播放器中播放视频、音频或图片；项目不会直接挂载任何存储服务。

## 功能

- 在固定根路径 `/root` 下创建链接伪挂载
- 播放视频、音频和图片
- 使用 JASSUB/libass 和内置中日文回退字体在浏览器中渲染可选 ASS 字幕
- 支持实时同步 LRC 歌词、单文件自动适配和可选双语歌词
- 根据 IP 自动选择英语、简体中文或日语，并支持手动覆盖
- 手动访问 `/admin`，验证密码后进入类似 OpenList 的管理表格
- 使用 Cloudflare D1 持久化，本地无 D1 时使用内存回退
- 可选 Umami 统计

## 本地运行

运行 `一键启动.cmd`，或执行：

```bash
npm install
npm run dev
```

默认管理员密码为 `masteradmin`。手动打开 `/admin` 登录；通过变量 `P` 修改密码。

## Cloudflare D1

当前项目已在 `wrangler.toml` 中启用 D1 绑定。部署到其他 Cloudflare 账户时，需要创建 D1 数据库，并将 `database_name` 和 `database_id` 替换为新数据库的值：

```toml
[[d1_databases]]
binding = "DB"
database_name = "你的数据库名称"
database_id = "你的-cloudflare-d1-database-id"
```

RP 会自动创建并升级 `rp_pseudo_links` 表。D1 绑定名必须保持为 `DB`。

## 短变量

| 变量 | 用途 |
| --- | --- |
| `H` | 内置在线音乐目录的显示名称 |
| `I` | 在线音乐开关（`1`、`true`、`yes` 或 `on` 表示开启） |
| `M` | 内置“在线音乐”目录使用的网易云歌单 ID |
| `N` | 网站名称 |
| `P` | 管理员密码 |
| `DB` | D1 绑定 |
| `US` | Umami 脚本地址 |
| `UI` | Umami 网站 ID |
| `UH` | 可选 Umami 主机地址 |
| `UD` | 可选 Umami 域名列表 |

在线音乐默认通过 `I=0` 关闭。`H` 默认为 `在线音乐`，`M` 默认为 `17810937506`。开启后，内置目录通过固定的 Meting 接口读取该歌单，无需认证 token。

## Umami

仅当 `US` 和 `UI` 同时配置时加载 Umami：

```text
US=https://cloud.umami.is/script.js
UI=你的网站-id
```

`UH` 和 `UD` 分别对应 Umami 的可选 `data-host-url` 和 `data-domains` 设置。

## ASS 字幕

添加视频时可填写公开的 HTTP(S) `.ass` 字幕链接。RP 会通过站内字幕接口读取已配置的字幕，避免普通浏览器跨域限制；播放器会按每份字幕实际使用的字符请求小型 Noto Sans 字体子集，字体服务不可用时再回退到站内 SC/JP 字体。字幕来源仍需能被 Cloudflare Workers 访问。

## LRC 歌词

添加音频时可填写一个公开的 HTTP(S) `.lrc` 歌词链接；开启“是否双语”后可再填写另一语言歌词链接。RP 会通过站内接口读取歌词以避免普通浏览器跨域限制，并实时高亮、滚动当前歌词。检测到中文轨时中文显示在上、外语显示在下；无法判断语言时，另一语言歌词在上、默认歌词在下。单个 LRC 中相同时间戳包含两行内容时会自动适配为双行显示。

## 自动语言

浏览器尚未保存手动语言偏好时，RP 会调用免费且无需密钥的 `api.country.is` 查询访客国家。`CN` 自动使用简体中文，`JP` 自动使用日语，其他国家使用英语；查询失败时回退到 Cloudflare 请求中的国家信息。手动选择会保存在浏览器中，并始终优先于自动判断。

## 部署

```bash
无需更改cloudflared的部署与构建命令

如要本地运行可直接运行“一键启动.cmd"
```
