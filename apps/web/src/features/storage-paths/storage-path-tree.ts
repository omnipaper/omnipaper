// Derives a one-level folder view from the flat `storage_paths` list. Paths are slash-delimited
// strings (e.g. "/Finance/2024"); there is no parent/child column — the tree is computed here.
// Drive semantics: a node exposes only its *direct* child folders plus the documents assigned to
// the node's exact path. A folder can be both a container (has children) and an assigned path.

export type StoragePathEntry = {
  id: string;
  path: string;
  documentCount: number;
  description?: string | null;
};

export type FolderChild = {
  name: string; // last segment, the display label
  path: string; // full storage_paths.path value — the value for `?storagePath=`
  docCount: number; // documents in this child's whole subtree
  exactId: string | null; // the storage_path id if this child is itself an assigned path
};

export type FolderNode = {
  breadcrumbs: { name: string; path: string }[]; // cumulative, root excluded
  exactPath: StoragePathEntry | null; // the path equal to the current folder, if any
  childFolders: FolderChild[];
};

export function pathSegments(path: string): string[] {
  return path.split("/").filter(Boolean);
}

// `currentPath` is the folder being viewed (a `storage_paths.path` value); null/undefined = root.
export function buildFolderNode(
  paths: readonly StoragePathEntry[],
  currentPath: string | null | undefined,
): FolderNode {
  const prefix = currentPath ? pathSegments(currentPath) : [];

  const breadcrumbs = prefix.map((name, i) => ({
    name,
    path: `/${prefix.slice(0, i + 1).join("/")}`,
  }));

  let exactPath: StoragePathEntry | null = null;
  const children = new Map<string, { docCount: number; exactId: string | null }>();

  for (const entry of paths) {
    const segs = pathSegments(entry.path);

    // Skip anything not sitting under the current prefix.
    if (segs.length < prefix.length) continue;
    if (prefix.some((seg, i) => segs[i] !== seg)) continue;

    if (segs.length === prefix.length) {
      exactPath = entry; // the path equal to this folder
      continue;
    }

    // A descendant — its segment at the prefix depth is one of this node's child folders.
    const childName = segs[prefix.length];
    if (!childName) continue;
    const agg = children.get(childName) ?? { docCount: 0, exactId: null };
    agg.docCount += entry.documentCount;
    if (segs.length === prefix.length + 1) {
      agg.exactId = entry.id; // the child is itself an assigned path (direct child)
    }
    children.set(childName, agg);
  }

  const childFolders: FolderChild[] = [...children.entries()]
    .map(([name, agg]) => ({
      name,
      path: `/${[...prefix, name].join("/")}`,
      docCount: agg.docCount,
      exactId: agg.exactId,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return { breadcrumbs, exactPath, childFolders };
}
