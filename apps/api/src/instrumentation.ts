import { env } from "@omnipaper/env";

// Tracing is opt-in at runtime (LANGFUSE_PUBLIC_KEY) and opt-in at build time
// (docker build --build-arg WITH_TRACING=true). The OpenTelemetry packages live in
// @omnipaper/tracing and are only installed into the image for a WITH_TRACING build,
// so the import is dynamic and its absence is not fatal.
let flush: () => Promise<void> = async () => {};

if (env.LANGFUSE_PUBLIC_KEY) {
  try {
    const { startTracing, stopTracing } = await import("@omnipaper/tracing");
    startTracing();
    flush = stopTracing;
  } catch (err) {
    console.warn(
      "[tracing] LANGFUSE_PUBLIC_KEY is set but @omnipaper/tracing is unavailable, so no traces " +
        "will be exported. Rebuild the image with --build-arg WITH_TRACING=true to enable it.",
      err instanceof Error ? err.message : err,
    );
  }
}

/** Flushes buffered spans on shutdown. No-op unless tracing actually started. */
export function flushTracing(): Promise<void> {
  return flush();
}
