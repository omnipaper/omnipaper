import { Input } from "@omnipaper/ui/components/input";
import { cn } from "@omnipaper/ui/lib/utils";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  useDocumentSearch,
  useDocumentSearchPatch,
} from "@/features/documents/filters/use-document-search";

export function DocumentSearchInput({
  orgId,
  local = false,
  className,
}: {
  orgId: string;
  local?: boolean;
  className?: string;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const search = useDocumentSearch();
  const patch = useDocumentSearchPatch();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const documentsBase = `/dashboard/orgs/${orgId}/documents`;
  const onCollection = pathname === documentsBase || pathname === `${documentsBase}/fileview`;
  const patchInPlace = local || onCollection;
  const [text, setText] = useState(patchInPlace ? (search.q ?? "") : "");

  const submit = useCallback(
    (raw: string) => {
      const q = raw.trim();
      if (patchInPlace) {
        patch({ q: q || undefined });
      } else if (q) {
        navigate({
          to: "/dashboard/orgs/$orgId/documents",
          params: { orgId },
          search: { q },
        });
      }
    },
    [navigate, patch, patchInPlace, orgId],
  );

  useEffect(() => {
    const timeout = setTimeout(() => submit(text), 300);
    return () => clearTimeout(timeout);
  }, [text, submit]);

  useEffect(() => {
    if (inputRef.current !== document.activeElement) {
      setText(patchInPlace ? (search.q ?? "") : "");
    }
  }, [patchInPlace, search.q]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        e.key === "/" &&
        target.tagName !== "INPUT" &&
        target.tagName !== "TEXTAREA" &&
        !target.isContentEditable
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={cn("relative", className)}>
      <SearchIcon
        aria-hidden
        className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-4 size-4 text-muted-foreground"
      />
      <Input
        ref={inputRef}
        type="search"
        placeholder="Search documents…"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="h-full w-full rounded-full pr-4 pl-11"
      />
    </div>
  );
}
