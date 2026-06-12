import { createFileRoute } from "@tanstack/react-router";
import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/source";

const server = createFromSource(source, {
  // https://docs.orama.com/docs/orama-js/supported-languages
  language: "english",
});

// The .json extension matters: the index is prerendered to a static file, and
// extensionless files get shadowed by clean-URL handling on static hosts.
export const Route = createFileRoute("/api/search.json")({
  server: {
    handlers: {
      GET: () => server.staticGET(),
    },
  },
});
