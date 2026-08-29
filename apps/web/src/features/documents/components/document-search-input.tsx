import { Input } from "@omnipaper/ui/components/input";
import { cn } from "@omnipaper/ui/lib/utils";
import { useLocation, useNavigate, useSearch } from "@tanstack/react-router";
import { SearchIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DocumentSearch } from "@/features/documents/filters/types";

// The search box in two scopes. Default (the header): on the document collection routes
// (/documents, saved views, file view) it live-patches ?q so you stay where you are; from any
// other page it jumps to /documents with the query, and the header instance survives that route
// change so focus is uninterrupted. `local`: live-patches ?q on the current route and never
// navigates — Home uses this to filter its own list in place. "/" focuses the search from anywhere.
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
  const search = useSearch({ strict: false }) as DocumentSearch;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const documentsBase = `/dashboard/orgs/${orgId}/documents`;
  const onCollection = pathname === documentsBase || pathname === `${documentsBase}/fileview`;
  const patchInPlace = local || onCollection;
  const [text, setText] = useState(patchInPlace ? (search.q ?? "") : "");

  const submit = useCallback(
    (raw: string) => {
      const q = raw.trim();
      if (patchInPlace) {
        navigate({
          to: ".",
          replace: true,
          search: (prev) => ({ ...(prev as DocumentSearch), q: q || undefined }),
        });
      } else if (q) {
        navigate({
          to: "/dashboard/orgs/$orgId/documents",
          params: { orgId },
          search: { q },
        });
      }
    },
    [navigate, patchInPlace, orgId],
  );

  useEffect(() => {
    const timeout = setTimeout(() => submit(text), 300);
    return () => clearTimeout(timeout);
  }, [text, submit]);

  // Mirror the URL when not actively typing: arriving at /documents?q=foo shows "foo", leaving
  // /documents clears the box.
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

  // className sizes the wrapper (height, width); the input fills it and reserves room for the glass.
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
