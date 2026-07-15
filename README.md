# Re Player (RP)

English | [简体中文](README.zh-CN.md)

Re Player is a link-based media library that uses the Astro framework and runs on Cloudflare Workers. Visitors browse a virtual `/root` tree in the left panel and play video, audio, or images in the browser player on the right. No storage provider is mounted directly.

## Features

- Link pseudo-mounts under the required `/root` path
- Video, audio, and image playback
- Optional ASS subtitles rendered in the browser with JASSUB/libass
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

The synchronized local copy is stored in `S:\pr-local`. Run `npm run sync:local` after changes; it also creates `run-local-preview.cmd` and `一键启动.cmd` in that folder.

## Cloudflare D1

Create a D1 database and replace the placeholder `database_id` in `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "rp"
database_id = "your-cloudflare-d1-database-id"
```

RP creates and upgrades the `rp_pseudo_links` table automatically. The D1 binding name must remain `DB`.

## Short Variables

| Variable | Purpose |
| --- | --- |
| `N` | Site name |
| `P` | Administrator password |
| `DB` | D1 binding |
| `US` | Umami script URL |
| `UI` | Umami website ID |
| `UH` | Optional Umami host URL |
| `UD` | Optional Umami domain list |

## Umami

Umami loads only when both `US` and `UI` are configured:

```text
US=https://cloud.umami.is/script.js
UI=your-website-id
```

`UH` and `UD` map to Umami's optional `data-host-url` and `data-domains` tracker settings.

## ASS Subtitles

When adding a video, enter a public HTTP(S) URL to an `.ass` subtitle file. RP fetches that configured subtitle through its own public subtitle endpoint, which avoids ordinary browser CORS restrictions. The subtitle source must still be reachable from Cloudflare Workers.

## Automatic Language

When no manual language preference has been saved, RP uses the free, keyless `api.country.is` service to determine the visitor country. `CN` selects Simplified Chinese, `JP` selects Japanese, and every other country selects English. Cloudflare's request country is used as a fallback when the lookup service is unavailable. A manual selection is stored in the browser and always takes priority.

## Deploy

```bash
npm run cf:deploy
```
