import type { ExportDocumentRow } from "@omnipaper/database/queries/documents";
import { extensionForMimeType } from "@omnipaper/shared/formats";
import type { StorageDriver } from "@omnipaper/storage/driver";
import { Zip, ZipPassThrough } from "fflate";
import { httpLogger } from "../logger";

// Zip entries must be uniquely named, so a document whose filename collides gets a " (2)" suffix.
function exportFileName(doc: ExportDocumentRow, used: Set<string>): string {
  const raw = (doc.originalFilename ?? doc.title ?? doc.id).replace(/[\\/:*?"<>|]/g, "_").trim();
  const safe = raw || doc.id;
  const hasExt = safe.lastIndexOf(".") > 0;
  let name = hasExt ? safe : safe + (extensionForMimeType(doc.mimeType) ?? "");

  if (used.has(name)) {
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    let i = 2;

    while (used.has(`${stem} (${i})${ext}`)) {
      i++;
    }

    name = `${stem} (${i})${ext}`;
  }

  used.add(name);
  return name;
}

// Streams the documents as a zip while they are still being fetched from storage, so the response
// starts before the whole archive exists and nothing is buffered in memory.
export function createDocumentsZipStream({
  driver,
  docs,
}: {
  driver: StorageDriver;
  docs: ExportDocumentRow[];
}): ReadableStream<Uint8Array> {
  const used = new Set<string>();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      const zip = new Zip((err, chunk, final) => {
        if (err) {
          controller.error(err);
          return;
        }

        controller.enqueue(chunk);

        if (final) {
          controller.close();
        }
      });

      (async () => {
        try {
          for (const doc of docs) {
            const obj = await driver.getObject({ key: doc.storageKey });

            if (!obj) {
              continue;
            }

            const entry = new ZipPassThrough(exportFileName(doc, used));
            zip.add(entry);
            entry.push(new Uint8Array(obj.body), true);
          }

          zip.end();
        } catch (err) {
          // The response headers are already sent by now, so the client only sees a truncated
          // download; without this the failure would leave no trace at all.
          httpLogger.error(
            { err, documentCount: docs.length },
            "document export failed mid-stream",
          );
          controller.error(err as Error);
        }
      })();
    },
  });
}
