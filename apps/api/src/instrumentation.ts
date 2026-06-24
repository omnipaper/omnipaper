import { env } from "@omnipaper/env";


if (process.env.NODE_ENV === "production") {
  //do nothing
} else if (process.env.NODE_ENV !== "production" && env.LANGFUSE_PUBLIC_KEY) {
  const { NodeSDK } = await import("@opentelemetry/sdk-node");
  const { LangfuseSpanProcessor } = await import("@langfuse/otel");

  const sdk = new NodeSDK({
    spanProcessors: [new LangfuseSpanProcessor()],
  });
  sdk.start();
}