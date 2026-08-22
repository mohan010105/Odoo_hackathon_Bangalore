// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const presetOverride = process.env["NITRO_PRESET"];

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Outside Lovable the build defaults to a portable Node server bundle
  // (dist/client + dist/server/index.mjs) so `npm run build && npm run preview`
  // works on any machine. Set NITRO_PRESET (e.g. vercel, netlify,
  // cloudflare-module) to target a specific hosting platform instead — that
  // preset then owns its own output layout.
  nitro: presetOverride
    ? { preset: presetOverride }
    : {
        preset: "node-server",
        output: { dir: "dist", serverDir: "dist/server", publicDir: "dist/client" },
      },
});
