import { ACCEPT_ATTRIBUTE } from "@omnipaper/shared/formats";
import { Button } from "@omnipaper/ui/components/button";
import { type ChangeEvent, useRef } from "react";
import { useUploadDocuments } from "@/features/documents/queries/upload";

export function UploadButton({ orgId }: { orgId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, isPending, progress } = useUploadDocuments(orgId);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    upload(files);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        className="hidden"
        onChange={handleChange}
      />
      <Button onClick={() => inputRef.current?.click()} disabled={isPending}>
        {progress ? `Uploading ${progress.done}/${progress.total}…` : "Upload"}
      </Button>
    </>
  );
}
