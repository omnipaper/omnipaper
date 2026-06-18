import { UploadIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function GlobalDropArea({ onFilesDrop }: { onFilesDrop: (files: File[]) => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const onFilesDropRef = useRef(onFilesDrop);
  onFilesDropRef.current = onFilesDrop;

  useEffect(() => {
    const isFileDrag = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

    const onDragOver = (e: DragEvent) => {
      if (!isFileDrag(e)) {
        return;
      }
      e.preventDefault();
      setIsDragging(true);
    };

    const onDragLeave = (e: DragEvent) => {
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
