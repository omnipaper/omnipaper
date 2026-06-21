// Public surface of the workflows DSL: registries, Zod schemas, and shared value types. Imported as
// `@omnipaper/shared/workflows` by the database (jsonb $type), queue, api (validation/execution),
// and web (builder + chips) — one source of truth for the shape of a workflow.
export * from "./actions";
export * from "./ai-assign";
export * from "./results";
export * from "./schema";
export * from "./suggestions";
export * from "./triggers";
