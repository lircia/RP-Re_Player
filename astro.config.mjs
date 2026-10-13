import { defineConfig, sessionDrivers } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import { fileURLToPath } from "node:url";

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    imageService: "passthrough",
    prerenderEnvironment: "node"
  }),
  session: {
    driver: sessionDrivers.null()
  },
  vite: {
    resolve: {
      alias: {
        mediabunny: fileURLToPath(new URL("./src/lib/mediabunny-compat.ts", import.meta.url))
      }
    },
    server: {
      host: "0.0.0.0"
    }
  }
});
