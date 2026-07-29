# Re Player (RP)

English | [简体中文](README.zh-CN.md)

Re Player is a link-based media library that uses the Astro framework and runs on Cloudflare Workers. Visitors browse a virtual `/root` tree in the left panel and play video, audio, or images in the browser player on the right. No storage provider is mounted directly.

## Features

- Link pseudo-mounts under the required `/root` path
- Video, audio, and image playback
- Optional ASS subtitles rendered in the browser with JASSUB/libass and bundled Chinese/Japanese font fallbacks
- Synchronized LRC lyrics with single-file adaptation and optional bilingual tracks
- Automatic IP-based English, Simplified Chinese, or Japanese selection with a manual override
- Password-protected `/admin` console with an OpenList-style file table
- Cloudflare D1 persistence with an in-memory local fallback
- Optional Umami analytics

## Local Run

Run `一键启动.cmd`, or use:

```bash
npm install
npm run dev
```

The default administrator password is `masteradmin`. Open `/admin` manually to sign in. Set `P` to change the password.

## Cloudflare D1

The current project already has an active D1 binding in `wrangler.toml`. When deploying to another Cloudflare account, create a D1 database and replace `database_name` and `database_id` with that database's values:

```toml
[[d1_databases]]
binding = "DB"
database_name = "your-database-name"
database_id = "your-cloudflare-d1-database-id"
```

RP creates and upgrades the `rp_pseudo_links` table automatically. The D1 binding name must remain `DB`.

## Short Variables

| Variable | Purpose |
| --- | --- |
| `H` | Display name of the built-in online music directory |
| `I` | Online music switch (`1`, `true`, `yes`, or `on` enables it) |
| `M` | NetEase playlist ID for the built-in Online Music directory |
| `N` | Site name |
| `P` | Administrator password |
| `DB` | D1 binding |
| `US` | Umami script URL |
| `UI` | Umami website ID |
| `UH` | Optional Umami host URL |
| `UD` | Optional Umami domain list |

Online music is disabled by default with `I=0`. `H` defaults to `在线音乐`, and `M` defaults to `17810937506`. When enabled, the built-in directory uses this playlist through fixed Meting endpoints and does not require an authentication token.

## Umami

Umami loads only when both `US` and `UI` are configured:

```text
US=https://cloud.umami.is/script.js
UI=your-website-id
```

`UH` and `UD` map to Umami's optional `data-host-url` and `data-domains` tracker settings.

## ASS Subtitles

When adding a video, enter a public HTTP(S) URL to an `.ass` subtitle file. RP fetches that configured subtitle through its own public subtitle endpoint, which avoids ordinary browser CORS restrictions. The player requests small Noto Sans subsets for the characters used by each subtitle; locally hosted SC/JP files remain as a fallback when the font service is unavailable. The subtitle source must still be reachable from Cloudflare Workers.

## LRC Lyrics

When adding audio, enter one public HTTP(S) `.lrc` URL for synchronized lyrics. Enable **Bilingual lyrics** to add a second language file. RP proxies both files to avoid ordinary browser CORS restrictions, highlights and scrolls the current line in real time, and places detected Chinese lyrics above the foreign-language line. If language detection is inconclusive, the other-language file appears above the default file. A single LRC containing two lines at the same timestamp is adapted automatically.

## Automatic Language

When no manual language preference has been saved, RP uses the free, keyless `api.country.is` service to determine the visitor country. `CN` selects Simplified Chinese, `JP` selects Japanese, and every other country selects English. Cloudflare's request country is used as a fallback when the lookup service is unavailable. A manual selection is stored in the browser and always takes priority.

## Deploy

```bash
You don't need to change Cloudflared's build command.

If you want to run it locally,please run 一键启动.cmd
```
