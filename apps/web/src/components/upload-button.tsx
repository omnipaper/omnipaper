import { Button } from "@omnipaper/ui/components/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type ChangeEvent, useRef } from "react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { documentKeys } from "../lib/queries/documents";

export function UploadButton({ orgId }: { orgId: string }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
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
    },
    onSuccess: (_data, file) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.lists(orgId) });
      toast.success(`Uploaded ${file.name}`);
    },
    onError: () => {
      toast.error("Upload failed");
    },
  });

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file) {
      uploadMutation.mutate(file);
    }

    event.target.value = "";
  }

  return (
    <>
      <input ref={inputRef} type="file" className="hidden" onChange={handleChange} />
      <Button onClick={() => inputRef.current?.click()} disabled={uploadMutation.isPending}>
        {uploadMutation.isPending ? "Uploading…" : "Upload"}
      </Button>
    </>
  );
}
