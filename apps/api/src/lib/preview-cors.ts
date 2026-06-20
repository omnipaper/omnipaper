// In-browser PDF preview (pdf.js) fetches the file straight from the storage endpoint via a
// presigned URL, so that one request is cross-origin and subject to bucket CORS. Everything else
// (upload, thumbnails, download, export) is proxied through the API and needs no CORS.
//
// We can't ask the server "can you reach the bucket?" — the server doesn't enforce CORS, so it
// would always succeed. Instead we send the exact preflight the browser would (an OPTIONS with the
// caller's Origin) and read the CORS response headers: that mirrors the browser's own decision.

export type PreviewCorsResult =
  | { status: "ok" }
  | { status: "cors_missing" }
  | { status: "mixed_content" }
  | { status: "no_origin" }
  | { status: "unreachable"; error: string };

export async function probePreviewCors({
  url,
  origin,
}: {
  url: string;
  origin: string | undefined;
}): Promise<PreviewCorsResult> {
  if (!origin) {
    return { status: "no_origin" };
  }

  const target = new URL(url);

  // An https app can't fetch an http storage endpoint — the browser blocks it as mixed content no
  // matter how CORS is set. Flag it on its own, because the fix is "use https", not a CORS rule.
  if (target.protocol === "http:" && origin.startsWith("https:")) {
    return { status: "mixed_content" };
  }

  // The exact preflight pdf.js triggers for a ranged GET. Preflight is unauthenticated, so the
  // presigned signature on `url` is irrelevant here — we only care about the CORS response headers.
  let response: Response;
  try {
    response = await fetch(target, {
      method: "OPTIONS",
      headers: {
        origin,
        "access-control-request-method": "GET",
        "access-control-request-headers": "range",
      },
    });
  } catch (error) {
    return {
      status: "unreachable",
      error: error instanceof Error ? error.message : "Request failed",
    };
  }

  const allowOrigin = response.headers.get("access-control-allow-origin");
  const allowMethods = (response.headers.get("access-control-allow-methods") ?? "").toUpperCase();
  const allowHeaders = (response.headers.get("access-control-allow-headers") ?? "").toLowerCase();

  const originAllowed = allowOrigin === "*" || allowOrigin === origin;
  const methodAllowed = allowMethods.includes("GET") || allowMethods.includes("*");
  const rangeAllowed = allowHeaders.includes("range") || allowHeaders.includes("*");

  return originAllowed && methodAllowed && rangeAllowed
    ? { status: "ok" }
    : { status: "cors_missing" };
}
