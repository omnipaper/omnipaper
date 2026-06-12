import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    mdx(),
    tailwindcss(),
    tanstackStart({
      spa: {
        enabled: true,
        // The shell page is injected with `path: maskPath` and would collide with the
        // real "/" page below (prerender dedupes by path) — keep it off the root.
        maskPath: "/_shell",
        prerender: {
          enabled: true,
          crawlLinks: true,
          // Emit the SPA shell as 404.html — static hosts serve it as the
          // not-found fallback, so unknown paths hydrate into the client router.
          outputPath: "/404",
        },
      },
      pages: [
        { path: "/" },
        { path: "/api/search.json" },
        { path: "/llms.txt" },
        { path: "/llms-full.txt" },
      ],
    }),
    react(),
    nitro(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: process.env.PORT ? Number(process.env.PORT) : 5174,
  },
});
