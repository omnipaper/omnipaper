import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { documentKeys } from "./documents";

// How many files one upload may contain. Enforced in JS — neither <input type="file"> nor a
// drag-drop caps the number of files natively.
export const MAX_FILES = 100;

// One multipart POST per file. A small pool keeps API load sane while still being much faster than
// one-at-a-time.
const UPLOAD_CONCURRENCY = 4;

type UploadOutcome = "created" | "duplicate";

// Raw fetch (not the typed client) — the body is multipart, not JSON; $url keeps the path typed.
// The server hashes + dedupes; the browser just buckets the outcome.
async function uploadFile(orgId: string, file: File): Promise<UploadOutcome> {
  const url = api.orgs[":orgId"].documents.$url({ param: { orgId } });

  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(url, { method: "POST", body: formData, credentials: "include" });

  if (!res.ok) {
    throw new Error("Upload failed");
  }

  const { status } = (await res.json()) as { status: UploadOutcome };
  return status;
}

type BatchResult = { created: number; duplicate: number; failed: number };

// Worker pool over a shared cursor. Each file lands in one of three buckets, so one bad-or-duplicate
// file can't sink the batch.
async function uploadBatch(
  orgId: string,
  files: File[],
  onProgress: (done: number) => void,
): Promise<BatchResult> {
  let cursor = 0;
  let done = 0;
  const result: BatchResult = { created: 0, duplicate: 0, failed: 0 };

  async function worker() {
    while (cursor < files.length) {
      const file = files[cursor++];
      if (!file) {
        break;
      }
      try {
        const outcome = await uploadFile(orgId, file);
        if (outcome === "duplicate") {
          result.duplicate++;
        } else {
          result.created++;
        }
      } catch {
        result.failed++;
      }
      onProgress(++done);
    }
  }

  await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, files.length) }, worker));

  return result;
}

export type UploadProgress = { done: number; total: number } | null;

// Shared upload pipeline for the documents feature — used by both the Upload button and the global
// drag-and-drop area, so they behave identically (concurrency pool, progress, summary toasts).
export function useUploadDocuments(orgId: string) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<UploadProgress>(null);

  const mutation = useMutation({
    mutationFn: (files: File[]) => {
      setProgress({ done: 0, total: files.length });
      return uploadBatch(orgId, files, (done) => setProgress({ done, total: files.length }));
    },
    onSuccess: ({ created, duplicate, failed }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists(orgId) });

      const segments: string[] = [];
      if (created > 0) {
        segments.push(`Uploaded ${created} ${created === 1 ? "file" : "files"}`);
      }
      if (duplicate > 0) {
        segments.push(`skipped ${duplicate} duplicate${duplicate === 1 ? "" : "s"}`);
      }
      if (failed > 0) {
        segments.push(`${failed} failed`);
      }

      const message = segments.join(", ");
      const display = message.charAt(0).toUpperCase() + message.slice(1);

      if (failed > 0 && created === 0) {
        toast.error(display || "Upload failed");
      } else if (duplicate > 0 || failed > 0) {
        toast.warning(display);
      } else {
        toast.success(display);
      }
    },
    onError: () => {
      toast.error("Upload failed");
    },
    onSettled: () => {
      setProgress(null);
    },
  });

  function upload(files: File[]) {
    if (files.length === 0) {
      return;
    }

    if (files.length > MAX_FILES) {
      toast.error(
        `You can upload up to ${MAX_FILES} files at once (you selected ${files.length}).`,
      );
      return;
    }

    mutation.mutate(files);
  }

  return { upload, isPending: mutation.isPending, progress };
}
