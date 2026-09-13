export const STORAGE_PATH_PATTERN = /^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/;

export function normalizeStoragePath(raw: string): string {
  const segments = raw
    .normalize("NFC")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  return `/${segments.join("/")}`;
}

export function isValidStoragePath(value: string): boolean {
  return STORAGE_PATH_PATTERN.test(normalizeStoragePath(value));
}

export type FolderNode = {
  name: string;
  path: string;
  // null = virtual folder: an ancestor derived from deeper paths, no row of its own yet.
  pathId: string | null;
};

// Mirrors S3 prefix+delimiter: a folder exists when any stored path passes through it.
export function listChildFolders(
  paths: ReadonlyArray<{ id: string; path: string }>,
  prefix: string,
): FolderNode[] {
  const base = prefix === "/" ? "" : prefix;
  const byPath = new Map(paths.map((p) => [p.path, p.id]));
  const children = new Map<string, FolderNode>();

  for (const { path } of paths) {
    if (!path.startsWith(`${base}/`)) {
      continue;
    }
    const name = path.slice(base.length + 1).split("/")[0];
    if (!name || children.has(name)) {
      continue;
    }
    const childPath = `${base}/${name}`;
    children.set(name, { name, path: childPath, pathId: byPath.get(childPath) ?? null });
  }

  return [...children.values()];
}

export function subtreePathIds(
  paths: ReadonlyArray<{ id: string; path: string }>,
  prefix: string,
): string[] {
  const base = prefix === "/" ? "" : prefix;
  return paths.filter((p) => p.path === prefix || p.path.startsWith(`${base}/`)).map((p) => p.id);
}
