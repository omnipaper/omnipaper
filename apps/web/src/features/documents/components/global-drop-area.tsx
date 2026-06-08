import { UploadIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Drop files anywhere on the page to import them — a full-screen overlay shown only while dragging.
// Same pattern as Papra (global-drop-area) and paperless-ngx (app-level file-drop).
export function GlobalDropArea({ onFilesDrop }: { onFilesDrop: (files: File[]) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  // Hold the latest callback in a ref so listeners attach once, not on every render.
  const onFilesDropRef = useRef(onFilesDrop);
  onFilesDropRef.current = onFilesDrop;

  useEffect(() => {
    const isFileDrag = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

    const onDragOver = (e: DragEvent) => {
      if (!isFileDrag(e)) {
        return;
      }
      // Required so the browser fires `drop` instead of navigating to the file.
      e.preventDefault();
      setIsDragging(true);
    };

    const onDragLeave = (e: DragEvent) => {
      // relatedTarget is null only when the cursor leaves the window entirely.
      if (e.relatedTarget === null) {
        setIsDragging(false);
      }
    };

    const onDrop = (e: DragEvent) => {
      if (!isFileDrag(e)) {
        return;
      }
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length > 0) {
        onFilesDropRef.current(files);
      }
    };

    document.addEventListener("dragover", onDragOver);
    document.addEventListener("dragleave", onDragLeave);
    document.addEventListener("drop", onDrop);

    return () => {
      document.removeEventListener("dragover", onDragOver);
      document.removeEventListener("dragleave", onDragLeave);
      document.removeEventListener("drop", onDrop);
    };
  }, []);

  if (!isDragging) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-background/70 text-center backdrop-blur-sm">
      <UploadIcon className="size-10 text-muted-foreground" />
      <p className="font-semibold text-lg">Drop files to upload</p>
      <p className="text-muted-foreground text-sm">Drag documents anywhere to import them</p>
    </div>
  );
}
