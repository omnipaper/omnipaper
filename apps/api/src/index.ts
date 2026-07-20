import "./instrumentation";
import { migrate } from "@omnipaper/database/migrate";
import { waitForDatabase } from "@omnipaper/database/wait";
import { env } from "@omnipaper/env";
import { startWorker } from "@omnipaper/queue/worker";
import { serveStatic } from "hono/bun";
import { createApp } from "./app";
import { bootstrapDemoAdmin } from "./demo";
import { emailPollTask } from "./tasks/email-poll";
import { emailPollDispatchTask } from "./tasks/email-poll-dispatch";
import { ocrExtractTask } from "./tasks/ocr-extract";
import { textExtractTask } from "./tasks/text-extract";
import { thumbnailGenerateTask } from "./tasks/thumbnail-generate";
import { workflowDispatchTask } from "./tasks/workflow-dispatch";
import { workflowRunTask } from "./tasks/workflow-run";

const isProduction = process.env.NODE_ENV === "production";

let server: ReturnType<typeof Bun.serve> | null = null;
let runner: Awaited<ReturnType<typeof startWorker>> | null = null;
let draining = false;

// Keep this above the setup below, and above the `await runner.promise` that parks a worker-only
// process forever
const shutdown = async (signal: string) => {
  if (draining) return;
  draining = true;

  console.log(`${signal} received, draining`);
  // Neither stop() cancels work in flight: the server refuses new connections and lets open
  // requests finish, the runner stops taking jobs and waits out the ones it holds.
  await Promise.allSettled([server?.stop(), runner?.stop()]);

  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

await waitForDatabase();

if (isProduction) {
  await migrate();
}

if (env.SERVICES.includes("worker")) {
  runner = await startWorker({
    taskList: {
      "ocr-extract": ocrExtractTask,
      "text-extract": textExtractTask,
      "thumbnail-generate": thumbnailGenerateTask,
      "workflow-dispatch": workflowDispatchTask,
      "workflow-run": workflowRunTask,
      "email-poll": emailPollTask,
      "email-poll-dispatch": emailPollDispatchTask,
    },
    // Cron scheduling bypasses our JOB_SPECS, so maxAttempts must be set inline (?max=1) —
    // a failed tick shouldn't retry, the next tick 10 minutes later covers it.
    crontab: "*/10 * * * * email-poll-dispatch ?max=1",
  });
}

if (env.SERVICES.includes("web")) {
  await bootstrapDemoAdmin();

  const app = createApp();

  if (isProduction) {
    // Hashed assets are immutable; a missing one must 404, never fall back to index.html —
    // a 200 HTML response under a .js URL gets cached by CDNs and bricks the app after deploys.
    app.use(
      "/assets/*",
      serveStatic({
        root: "./apps/web/dist",
        onFound: (_path, c) => c.header("Cache-Control", "public, max-age=31536000, immutable"),
      }),
    );
    app.get("/assets/*", (c) => c.notFound());
    app.use("/*", serveStatic({ root: "./apps/web/dist" }));
    app.get("*", async (c, next) => {
      c.header("Cache-Control", "no-cache");
      return serveStatic({ path: "./apps/web/dist/index.html" })(c, next);
    });
  }

  server = Bun.serve({ fetch: app.fetch, port: env.PORT });
}

if (!server && runner) {
  await runner.promise;
}
