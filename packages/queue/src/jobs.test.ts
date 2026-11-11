import { describe, expect, it } from "bun:test";
import { JOB_DEFINITIONS } from "./jobs";

describe("queue job payloads", () => {
  it("accepts payloads for document processing jobs", () => {
    expect(JOB_DEFINITIONS["ocr-extract"].schema.safeParse({ documentId: "doc_1" }).success).toBe(
      true,
    );
    expect(JOB_DEFINITIONS["text-extract"].schema.safeParse({ documentId: "doc_1" }).success).toBe(
      true,
    );
    expect(
      JOB_DEFINITIONS["thumbnail-generate"].schema.safeParse({ documentId: "doc_1" }).success,
    ).toBe(true);
  });

  it("accepts all fields required by workflow jobs", () => {
    expect(
      JOB_DEFINITIONS["workflow-dispatch"].schema.safeParse({
        documentId: "doc_1",
        trigger: "document.created",
        triggerEventId: "event_1",
      }).success,
    ).toBe(true);

    expect(
      JOB_DEFINITIONS["workflow-run"].schema.safeParse({
        workflowId: "workflow_1",
        documentId: "doc_1",
        triggerEventId: "event_1",
      }).success,
    ).toBe(true);
  });

  it("accepts an empty payload for email-poll-dispatch", () => {
    expect(JOB_DEFINITIONS["email-poll-dispatch"].schema.safeParse({}).success).toBe(true);
  });

  it("accepts an account id for email polling", () => {
    expect(JOB_DEFINITIONS["email-poll"].schema.safeParse({ accountId: "account_1" }).success).toBe(
      true,
    );
  });

  it("rejects empty required identifiers", () => {
    expect(JOB_DEFINITIONS["ocr-extract"].schema.safeParse({ documentId: "" }).success).toBe(false);
    expect(JOB_DEFINITIONS["email-poll"].schema.safeParse({ accountId: "" }).success).toBe(false);
    expect(JOB_DEFINITIONS["workflow-run"].schema.safeParse({}).success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(
      JOB_DEFINITIONS["workflow-dispatch"].schema.safeParse({ documentId: "doc_1" }).success,
    ).toBe(false);
    expect(JOB_DEFINITIONS["ocr-extract"].schema.safeParse({}).success).toBe(false);
  });
});
