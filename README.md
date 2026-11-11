# Re Player Local

LAN-oriented local version of Re Player. It runs over HTTP and keeps Cloudflare deployment instructions out of this branch.

## Requirements

- Node.js 22 or newer
- npm

## Start

```bash
npm install
```

On Windows, run `Local.cmd`. On Linux, run:

```bash
npm run local
```

By default, the service listens at `http://127.0.0.1:12067`. The default admin password is `masteradmin`; open `/admin` to sign in. Set `P` in `.env` to change it.

## LAN Access

On Windows, set the computer's LAN IPv4 address in `Local.cmd` by changing:

```bat
set "IP=127.0.0.1"
```

For example, use `set "IP=192.168.1.20"`, replacing the example with the computer's actual LAN address. Run `Local.cmd`, then open `http://192.168.1.20:12067` from another device on the same network.

On Linux, build and pass the LAN address to the runner:

```bash
npm run build
node scripts/local.mjs 192.168.1.20
```

Replace the example with the computer's actual LAN address. Allow Node.js through the computer's firewall for private networks. Local media files and local `VP`/`AP` background images use TCP port `12068`, which must also be allowed.

Use an IPv4 address assigned to this computer. The address must remain the same while the service is running. The service uses HTTP without a self-signed certificate.

## Configuration

In Admin, mount a file by entering its absolute path in the media URL field, for example `S:\RP-Local\media\rein.mp4`. Local paths are read from the computer running Re Player and streamed with byte-range support; the source computer must remain on and the file must remain available. This works only in the Local version. HTTP(S) media links continue to work as usual.

To mount a local folder, enable **Mount local folder**, enter its absolute path in the media URL field, and choose the folder name shown in the library. **Include subdirectories** is unchecked by default; enable it to recursively import files while preserving their directory structure. File types are detected from extensions. Mount data is stored in `.local-data/wrangler` inside the project; keep this directory. Stop the Local service before copying it for backup.

Copy `.env.example` to `.env` and set only the variables you need. `RP_HTTP_PORT` changes the web port from `12067`. `VP` and `AP` accept image URLs or absolute local paths; `VPS` and `APS` control image opacity. The local helper serves configured local background files to LAN clients.

Source code is MIT licensed. Third-party components retain their own licenses; see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
