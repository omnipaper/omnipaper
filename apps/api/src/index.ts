import { migrate } from "@omnipaper/database/migrate";
import { waitForDatabase } from "@omnipaper/database/wait";
import { env } from "@omnipaper/env";
import { startWorker } from "@omnipaper/queue/worker";
import { serveStatic } from "hono/bun";
import { createApp } from "./app";
import { ocrExtractTask } from "./tasks/ocr-extract";

const services = env.SERVICES.split(",").map((service) => service.trim());
const isProduction = process.env.NODE_ENV === "production";

// Compose has no depends_on and Swarm ignores it — wait until Postgres accepts connections.
await waitForDatabase();

// Migrations run automatically in the published image; in dev you run them yourself (db:migrate).
if (isProduction) {
  await migrate();
}

const runner = services.includes("worker")
  ? await startWorker({ taskList: { "ocr-extract": ocrExtractTask } })
  : null;

if (services.includes("web")) {
  const app = createApp();

  // In the image the built SPA is baked in and served by the same process (single origin).
  // In dev this is skipped — Vite serves the web on its own port.
  if (isProduction) {
    app.use("/*", serveStatic({ root: "./apps/web/dist" }));
    app.get("*", serveStatic({ path: "./apps/web/dist/index.html" }));
  }

  Bun.serve({ fetch: app.fetch, port: env.PORT });
} else if (runner) {
  await runner.promise;
}
