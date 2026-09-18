import { OpenTelemetry } from "@ai-sdk/otel";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { env } from "@omnipaper/env";
import { createLogger } from "@omnipaper/logger";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { registerTelemetry } from "ai";

const logger = createLogger("tracing");

let sdk: NodeSDK | undefined;

/**
 * Starts OpenTelemetry and routes AI SDK spans to Langfuse.
 *
 * The caller decides whether tracing should run at all; this only wires it up.
 * Safe to call more than once: later calls are ignored.
 */
export function startTracing(): void {
  if (sdk) return;

  // The processor reads the keys from the environment itself, but it looks for
  // LANGFUSE_BASE_URL and would otherwise silently fall back to Langfuse Cloud while a
  // self-hoster believes LANGFUSE_URL is pointing it at their own instance.
  sdk = new NodeSDK({
    spanProcessors: [new LangfuseSpanProcessor({ baseUrl: env.LANGFUSE_URL })],
  });
  sdk.start();
  registerTelemetry(new OpenTelemetry());

  logger.info(
    { baseUrl: env.LANGFUSE_URL ?? "https://cloud.langfuse.com" },
    "tracing started, exporting AI SDK spans to Langfuse",
  );
}

/**
 * Flushes buffered spans and shuts the SDK down.
 *
 * Spans are batched, so without this every redeploy drops whatever the last batch held.
 * Safe to call when tracing never started.
 */
export async function stopTracing(): Promise<void> {
  if (!sdk) return;

  const running = sdk;
  sdk = undefined;
  await running.shutdown();
}
