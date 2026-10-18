import { env } from "@omnipaper/env";
import { serverLogger } from "./logger";

let shutdown: (() => Promise<void>) | null = null;

if (env.LANGFUSE_PUBLIC_KEY) {
  try {
    // Deliberately not in this workspace's dependencies: the image only carries
    // @omnipaper/tracing when built with WITH_TRACING=true (see docker/Dockerfile).
    const { startTracing } = await import("@omnipaper/tracing/start");
    const tracing = startTracing({
      publicKey: env.LANGFUSE_PUBLIC_KEY,
      secretKey: env.LANGFUSE_SECRET_KEY,
      baseUrl: env.LANGFUSE_URL,
    });
    shutdown = tracing.shutdown;
    serverLogger.info("tracing enabled");
  } catch (err) {
    if ((err as { code?: string }).code !== "ERR_MODULE_NOT_FOUND") throw err;
    serverLogger.warn(
      "LANGFUSE_PUBLIC_KEY is set but this image was built without tracing, rebuild with --build-arg WITH_TRACING=true",
    );
  }
}

export async function shutdownTracing() {
  await shutdown?.();
}
