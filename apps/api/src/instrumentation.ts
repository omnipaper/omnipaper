import { env } from "@omnipaper/env";

if (process.env.NODE_ENV !== "production" && env.LANGFUSE_PUBLIC_KEY) {
  const { NodeSDK } = await import("@opentelemetry/sdk-node");
  const { LangfuseSpanProcessor } = await import("@langfuse/otel");
  const { registerTelemetry } = await import("ai");
  const { OpenTelemetry } = await import("@ai-sdk/otel");

  const sdk = new NodeSDK({
    spanProcessors: [new LangfuseSpanProcessor()],
  });
  sdk.start();
  registerTelemetry(new OpenTelemetry());
}
