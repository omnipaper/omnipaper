import { Hono } from "hono";
import pkg from "../../../../package.json";
import { API_LEVEL, MIN_API_LEVEL } from "../api-level";
import type { Variables } from "../context";

export const healthRoutes = new Hono<{ Variables: Variables }>().get("/", (c) =>
  c.json({
    status: "ok",
    version: pkg.version,
    apiLevel: API_LEVEL,
    minApiLevel: MIN_API_LEVEL,
  }),
);
