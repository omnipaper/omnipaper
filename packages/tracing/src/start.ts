import { OpenTelemetry } from "@ai-sdk/otel";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { registerTelemetry } from "ai";

type StartTracingOptions = {
  publicKey: string;
  secretKey?: string;
  baseUrl?: string;
};

export function startTracing({ publicKey, secretKey, baseUrl }: StartTracingOptions) {
  const provider = new NodeTracerProvider({
    spanProcessors: [new LangfuseSpanProcessor({ publicKey, secretKey, baseUrl })],
  });
  provider.register();
  registerTelemetry(new OpenTelemetry());

  return { shutdown: () => provider.shutdown() };
}
