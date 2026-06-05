import { Hono } from "hono";
import type { Variables } from "../context";
import { requireAdmin } from "../middleware";

export const adminRoutes = new Hono<{ Variables: Variables }>().get("/check", requireAdmin, (c) =>
  c.json({ ok: true, role: c.get("user")?.role }),
);
