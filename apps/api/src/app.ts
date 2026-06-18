import { env } from "@omnipaper/env";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { auth } from "./auth";
import type { Variables } from "./context";
import { requireAuth, requireOrganization } from "./middleware";
import { customPropertiesRoutes } from "./routes/custom-properties";
import { documentTypesRoutes } from "./routes/document-types";
import { documentsRoutes } from "./routes/documents";
import { settingsRoutes } from "./routes/settings";
import { storagePathsRoutes } from "./routes/storage-paths";
import { tagsRoutes } from "./routes/tags";

export function createApp() {
  // Org-scoped routes live under /orgs/:orgId. requireOrganization reads :orgId from the path
  // and verifies membership, so the active org comes from the URL, not from session state.
  const orgRoutes = new Hono<{ Variables: Variables }>()
    .use("*", requireOrganization)
    .route("/documents", documentsRoutes)
    .route("/document-types", documentTypesRoutes)
    .route("/storage-paths", storagePathsRoutes)
    .route("/tags", tagsRoutes)
    .route("/custom-properties", customPropertiesRoutes);

  const apiRoutes = new Hono<{ Variables: Variables }>()
    .get("/me", (c) => c.json({ user: c.get("user") }))
    .use("/settings/*", requireAuth)
    .route("/settings", settingsRoutes)
    .use("/orgs/:orgId/*", requireAuth)
    .route("/orgs/:orgId", orgRoutes);

  const app = new Hono<{ Variables: Variables }>()
    .use(
      "*",
      cors({
        origin: [env.APP_URL, ...env.EXTRA_TRUSTED_ORIGINS],
        allowHeaders: ["Content-Type", "Authorization"],
        allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        credentials: true,
      }),
    )
    .use("*", async (c, next) => {
      const session = await auth.api.getSession({ headers: c.req.raw.headers });

      c.set("user", session?.user ?? null);
      c.set("session", session?.session ?? null);

      await next();
    })
    .onError((err, c) => {
      if (err instanceof HTTPException) {
        return err.getResponse();
      }

      console.error(err);

      return c.json({ error: { code: "internal_error", message: "Internal server error" } }, 500);
    })
    .on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw))
    .get("/health", (c) => c.json({ status: "ok" }))
    .route("/api", apiRoutes);

  return app;
}

export type AppType = ReturnType<typeof createApp>;
