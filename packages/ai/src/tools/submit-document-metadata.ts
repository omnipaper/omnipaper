import { tool } from "ai";
import { z } from "zod";
import type { ClassifyInput, ClassifyResult } from "../types";

const TITLE_MAX = 200;

function buildSchema(input: ClassifyInput) {
  const { fields, candidates } = input;
  const shape: Record<string, z.ZodTypeAny> = {};

  if (fields.documentType && candidates.documentTypes.length > 0) {
    const names = candidates.documentTypes.map((t) => t.name) as [string, ...string[]];
    shape.documentType = z.enum(names).nullable();
  }
  if (fields.storagePath && candidates.storagePaths.length > 0) {
    const paths = candidates.storagePaths.map((p) => p.path) as [string, ...string[]];
    shape.storagePath = z.enum(paths).nullable();
  }
  if (fields.tags) {
    shape.tags = z.array(z.string());
  }
  if (fields.documentDate) {
    shape.documentDate = z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable();
  }
  if (fields.title) {
    shape.title = z.string().nullable();
  }
  if (fields.customFields && candidates.customFields.length > 0) {
    const fieldNames = candidates.customFields.map((c) => c.name) as [string, ...string[]];
    shape.customFields = z.array(
      z.object({ field: z.enum(fieldNames), value: z.string().nullable() }),
    );
  }

  return z.object(shape);
}

function normalizeOutput(input: ClassifyInput, raw: ClassifyResult): ClassifyResult {
  const { fields, candidates } = input;
  const out: ClassifyResult = {};

  if (fields.documentType) {
    out.documentType = raw.documentType ?? null;
  }
  if (fields.storagePath) {
    out.storagePath = raw.storagePath ?? null;
  }
  if (fields.tags) {
    const seen = new Set<string>();
    const reserved = new Set(input.reservedTagNames.map((n) => n.toLowerCase()));
    out.tags = (raw.tags ?? [])
      .map((name) => name.trim())
      .filter((name) => {
        const key = name.toLowerCase();
        if (!name || seen.has(key) || reserved.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
  }
  if (fields.documentDate) {
    out.documentDate = raw.documentDate ?? null;
  }
  if (fields.title) {
    const value = raw.title?.trim();
    out.title = value ? value.slice(0, TITLE_MAX) : null;
  }
  if (fields.customFields) {
    const known = new Set(candidates.customFields.map((c) => c.name));
    out.customFields = (raw.customFields ?? []).filter(
      (c) => known.has(c.field) && c.value != null,
    );
  }

  return out;
}

function validateSubmission(input: ClassifyInput, raw: ClassifyResult): string[] {
  const errors: string[] = [];

  if (input.fields.tags && raw.tags && input.reservedTagNames.length > 0) {
    const reserved = new Set(input.reservedTagNames.map((n) => n.toLowerCase()));
    for (const name of raw.tags) {
      if (reserved.has(name.trim().toLowerCase())) {
        errors.push(
          `tags: "${name.trim()}" already exists but is not AI-eligible. Do not use or recreate it; pick a different tag or omit it.`,
        );
      }
    }
  }

  if (input.fields.customFields) {
    const byName = new Map(input.candidates.customFields.map((c) => [c.name, c]));
    for (const entry of raw.customFields ?? []) {
      const field = byName.get(entry.field);
      if (!field || entry.value == null) {
        continue;
      }
      if (field.type === "select" && !field.allowNew && !field.options.includes(entry.value)) {
        errors.push(
          `customFields["${entry.field}"]: "${entry.value}" is not a valid option. Pick one of: ${field.options.join(", ")}, or set value to null.`,
        );
      }
    }
  }

  return errors;
}

export function submitDocumentMetadataTool(input: ClassifyInput) {
  let captured: ClassifyResult | null = null;
  let lastAttempt: ClassifyResult | null = null;

  const instance = tool({
    description:
      "Submit the final extracted metadata. Call this exactly once when every value is ready.",
    inputSchema: buildSchema(input),
    execute: async (raw) => {
      const candidate = raw as ClassifyResult;
      lastAttempt = normalizeOutput(input, candidate);

      const errors = validateSubmission(input, candidate);
      if (errors.length > 0) {
        return { ok: false as const, errors };
      }

      captured = lastAttempt;
      return { ok: true as const };
    },
  });

  return {
    tool: instance,
    isDone: () => captured !== null,
    getResult: () => captured ?? lastAttempt ?? normalizeOutput(input, {}),
  };
}
