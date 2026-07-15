import { defineConfig, sessionDrivers } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

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
    server: {
      host: "0.0.0.0"
    }
  }
});
