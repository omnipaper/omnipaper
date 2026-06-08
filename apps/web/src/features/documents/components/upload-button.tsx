import { documentKeys } from "@/features/documents/queries/documents";
import { api } from "@/lib/api";
import { Button } from "@omnipaper/ui/components/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, useRef, useState } from "react";
import { toast } from "sonner";

// How many files a single selection may contain. Enforced in JS — <input type="file"> has no
// native cap on the number of files, only `multiple` on/off.
const MAX_FILES = 100;

// Each file is a 3-request chain (create → PUT to storage → process). Uploading the whole batch
// at once would open up to 100 chains in parallel; a small pool keeps storage/API load sane while
// still being much faster than one-at-a-time.
const UPLOAD_CONCURRENCY = 4;

async function uploadFile(orgId: string, file: File) {
  const contentType = file.type || "application/octet-stream";

  const res = await api.orgs[":orgId"].documents.$post({
    param: { orgId },
    json: {
      title: file.name,
      filename: file.name,
      mimeType: contentType,
      sizeBytes: file.size,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to create document");
  }

  const { documentId, uploadUrl } = await res.json();

  const put = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": contentType },
  });

  if (!put.ok) {
    throw new Error("Upload to storage failed");
  }

  const processRes = await api.orgs[":orgId"].documents[":id"].process.$post({
    param: { orgId, id: documentId },
  });

  if (!processRes.ok) {
    throw new Error("Failed to start processing");
  }
}

// Run uploads through a fixed-size pool: a few workers pull files off a shared cursor until the
// list is drained. A failed file is counted and skipped so one bad file can't sink the batch.
async function uploadBatch(orgId: string, files: File[], onProgress: (done: number) => void) {
  let cursor = 0;
  let done = 0;
  let succeeded = 0;

  async function worker() {
    while (cursor < files.length) {
      const file = files[cursor++];
      if (!file) {
        break;
      }
      try {
        await uploadFile(orgId, file);
        succeeded++;
      } catch {
        // Swallow per-file failures; the count drives the summary toast.
      }
      onProgress(++done);
    }
  }

  const workers = Array.from({ length: Math.min(UPLOAD_CONCURRENCY, files.length) }, worker);
  await Promise.all(workers);

  return { succeeded, failed: files.length - succeeded };
}

export function UploadButton({ orgId }: { orgId: string }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      setProgress({ done: 0, total: files.length });
      return uploadBatch(orgId, files, (done) => setProgress({ done, total: files.length }));
    },
    onSuccess: ({ succeeded, failed }) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists(orgId) });

      if (failed === 0) {
        toast.success(`Uploaded ${succeeded} ${succeeded === 1 ? "file" : "files"}`);
      } else if (succeeded === 0) {
        toast.error(`Failed to upload ${failed} ${failed === 1 ? "file" : "files"}`);
      } else {
        toast.warning(`Uploaded ${succeeded} of ${succeeded + failed} files, ${failed} failed`);
      }
    },
    onError: () => {
      toast.error("Upload failed");
    },
    onSettled: () => {
      setProgress(null);
    },
  });

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    if (files.length > MAX_FILES) {
      toast.error(
        `You can upload up to ${MAX_FILES} files at once (you selected ${files.length}).`,
      );
      return;
    }

    uploadMutation.mutate(files);
  }

  return (
    <>
      <input ref={inputRef} type="file" multiple className="hidden" onChange={handleChange} />
      <Button onClick={() => inputRef.current?.click()} disabled={uploadMutation.isPending}>
        {progress ? `Uploading ${progress.done}/${progress.total}…` : "Upload"}
      </Button>
    </>
  );
}
