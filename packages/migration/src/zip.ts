import type { Readable } from "node:stream";
import type { Entry, ZipFile } from "yauzl";
import yauzl from "yauzl";

export type ZipEntryInfo = { name: string; uncompressedSize: number };

export type ZipSource = {
  listEntries(): ZipEntryInfo[];
  hasEntry(name: string): boolean;
  openReadStream(name: string): Promise<Readable>;
  close(): Promise<void>;
};

// Backstops against pathological archives. Real Paperless exports are large but bounded: tens of
// thousands of documents, each one or a few entries; legitimate uncompressed totals reach tens of
// GB. These caps only reject the absurd — per-entry honesty is enforced by yauzl, and we stream
// (never fully buffer) entry bytes, so a single huge file costs IO/time, not memory.
const MAX_ENTRIES = 500_000;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 512 * 1024 * 1024 * 1024;

function isDirectoryEntry(entry: Entry): boolean {
  return entry.fileName.endsWith("/");
}

// Skip symlink entries: their "content" is a link target and materializing one would be a
// path-traversal vector. Only treat an entry as a symlink when the archive actually carries Unix
// mode bits saying so (externalFileAttributes 0 = DOS / no Unix info → a regular file, don't skip).
function isSymlinkEntry(entry: Entry): boolean {
  const S_IFMT = 0o170000;
  const S_IFLNK = 0o120000;
  return ((entry.externalFileAttributes >>> 16) & S_IFMT) === S_IFLNK;
}

function openZipFile(path: string): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(path, { lazyEntries: true, autoClose: false }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err ?? new Error("Failed to open archive"));
        return;
      }
      resolve(zipfile);
    });
  });
}

function readDirectory(zipfile: ZipFile): Promise<Map<string, Entry>> {
  return new Promise((resolve, reject) => {
    const entries = new Map<string, Entry>();
    let totalUncompressed = 0;

    zipfile.on("entry", (entry: Entry) => {
      if (!isDirectoryEntry(entry) && !isSymlinkEntry(entry)) {
        if (entries.size >= MAX_ENTRIES) {
          reject(new Error(`Archive has more than ${MAX_ENTRIES} entries`));
          return;
        }
        totalUncompressed += entry.uncompressedSize;
        if (totalUncompressed > MAX_TOTAL_UNCOMPRESSED_BYTES) {
          reject(new Error("Archive uncompressed size exceeds the allowed limit"));
          return;
        }
        entries.set(entry.fileName, entry);
      }
      zipfile.readEntry();
    });

    // yauzl emits "error" for invalid entry names (zip-slip: "..", absolute, backslashes), so a
    // malicious archive rejects here rather than ever resolving to a path outside the archive.
    zipfile.on("error", reject);
    zipfile.on("end", () => resolve(entries));

    zipfile.readEntry();
  });
}

function openEntryStream(zipfile: ZipFile, entry: Entry): Promise<Readable> {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err, stream) => {
      if (err || !stream) {
        reject(err ?? new Error(`Failed to read entry: ${entry.fileName}`));
        return;
      }
      resolve(stream);
    });
  });
}

export async function openZip(path: string): Promise<ZipSource> {
  const zipfile = await openZipFile(path);

  let entries: Map<string, Entry>;
  try {
    entries = await readDirectory(zipfile);
  } catch (err) {
    zipfile.close();
    throw err;
  }

  return {
    listEntries: () =>
      [...entries.values()].map((e) => ({
        name: e.fileName,
        uncompressedSize: e.uncompressedSize,
      })),
    hasEntry: (name) => entries.has(name),
    openReadStream: (name) => {
      const entry = entries.get(name);
      if (!entry) {
        return Promise.reject(new Error(`Entry not found: ${name}`));
      }
      return openEntryStream(zipfile, entry);
    },
    close: () =>
      new Promise<void>((resolve) => {
        zipfile.close();
        resolve();
      }),
  };
}
