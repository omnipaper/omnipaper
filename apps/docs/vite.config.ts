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
        maskPath: "/_shell",
        prerender: {
          enabled: true,
          crawlLinks: true,
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
