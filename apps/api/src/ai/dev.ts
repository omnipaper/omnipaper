/**
 * Dev harness for AI tools. Run from apps/api:
 *   bun --env-file=../../.env.local src/ai/dev.ts <documentId>              # dump history tool output
 *   bun --env-file=../../.env.local src/ai/dev.ts <documentId> <question>   # agent loop with tools
 */
import { resolveModel } from "@omnipaper/ai/model";
import { db } from "@omnipaper/database/client";
import { getDocumentById } from "@omnipaper/database/queries/documents";
import { getAiRuntimeConfig } from "@omnipaper/settings/ai-settings";
import { generateText, isStepCount } from "ai";
import { executeGetDocumentHistory } from "./tools/get-document-history/get-document-history";
import { aiTools, aiToolsContext } from "./tools/registry";

const [documentId, ...questionParts] = process.argv.slice(2);
const question = questionParts.join(" ");

if (!documentId) {
  console.log("usage: dev.ts <documentId> [question]");
  process.exit(1);
}

const doc = await getDocumentById(db, { id: documentId });
if (!doc) {
  console.log(`document ${documentId} not found`);
  process.exit(1);
}
const ctx = { organizationId: doc.organizationId };

if (!question) {
  const result = await executeGetDocumentHistory(ctx, { id: documentId });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

const runtime = await getAiRuntimeConfig();
if (!runtime.ok) {
  console.log(`AI not configured: ${runtime.detail}`);
  process.exit(1);
}

const result = await generateText({
  model: resolveModel(runtime.config.provider, runtime.config.model, runtime.config.apiKey),
  tools: aiTools,
  toolsContext: aiToolsContext(ctx),
  stopWhen: isStepCount(6),
  instructions:
    "You are a document assistant. Use the available tools to answer from real data; " +
    `the document in question has id ${documentId}.`,
  prompt: question,
});

for (const step of result.steps) {
  for (const call of step.toolCalls) {
    console.log(`→ ${call.toolName}(${JSON.stringify(call.input)})`);
  }
}
console.log(`\n${result.text}`);
process.exit(0);
