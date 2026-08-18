import { describe, expect, it } from "bun:test";
import type { OcrDefinition } from "./registry";
import {
  definitionsForProvider,
  getOcrDefinition,
  isOcrDefinitionId,
  listOcrDefinitions,
  resolveModel,
  supportsMime,
  OcrError
} from "./resolve";

describe("OCR definitions", () => {
  it("returns a registered definition by id", () => {
    const mistralDefinition = getOcrDefinition("mistral-ocr");

    expect(mistralDefinition.label).toBe("Mistral OCR");
    expect(mistralDefinition.provider).toBe("mistral");
    expect(mistralDefinition.lane).toBe("ocr");
  });

  it("rejects an unknown definition", () => {
    expect(() => getOcrDefinition("unknown-ocr")).toThrow(OcrError);
    expect(isOcrDefinitionId("unknown-ocr")).toBe(false);
    expect(isOcrDefinitionId("mistral-ocr")).toBe(true);
  });

  it("checks whether a definition supports a MIME type", () => {
    expect(supportsMime("mistral-ocr", "application/pdf")).toBe(true);
    expect(supportsMime("mistral-ocr", "image/jpeg")).toBe(true);
    expect(supportsMime("mistral-ocr", "text/plain")).toBe(false);
  });

  it("always uses the configured model for a fixed-model definition", () => {
    const definition = getOcrDefinition("mistral-ocr");

    expect(resolveModel(definition, "some-user-model")).toBe("mistral-ocr-latest");
    expect(resolveModel(definition)).toBe("mistral-ocr-latest");
  });

  it("uses a non-empty user model for an editable definition", () => {
    const definition: OcrDefinition = {
      id: "test-llm",
      label: "Test LLM",
      lane: "llm",
      provider: "google",
      defaultModel: "default-model",
      modelEditable: true,
      mimeTypes: ["text/plain"],
    };

    expect(resolveModel(definition, "custom-model")).toBe("custom-model");
    expect(resolveModel(definition, "  ")).toBe("default-model");
    expect(resolveModel(definition)).toBe("default-model");
  });

  it("lists definitions and filters them by provider", () => {
    expect(listOcrDefinitions()).toHaveLength(1);
    expect(definitionsForProvider("mistral")).toHaveLength(1);
    expect(definitionsForProvider("mistral")[0]?.id).toBe("mistral-ocr");
    expect(definitionsForProvider("google")).toEqual([]);
  });
});
