// Advisory security check: is the bucket world-readable? omnipaper itself works fine either way
// (it always uses server credentials or presigned URLs), but a publicly readable bucket means
// anyone with a file URL can read someone's documents — worth warning about, never blocking.
//
// Read-only probe: an ANONYMOUS GET (presigned signature stripped) on the connection-test dummy
// key. Across the engines we support (S3, R2, MinIO) a private bucket denies anonymous reads with
// 401/403 and won't even reveal whether the key exists; a publicly readable one processes the read
// and returns 404 (key absent) or 200. Anything else → inconclusive, and we stay silent rather than
// risk a false "your bucket is public" alarm.

export type BucketPrivacy = "private" | "public" | "unknown";

export async function probeBucketPrivacy({ url }: { url: string }): Promise<BucketPrivacy> {
  const plain = new URL(url);
  plain.search = ""; // drop the presigned query params → a fully anonymous request

  let response: Response;
  try {
    response = await fetch(plain, { method: "GET" });
  } catch {
    return "unknown";
  }

  if (response.status === 401 || response.status === 403) {
    return "private";
  }

  if (response.status === 200 || response.status === 404) {
    return "public";
  }

  return "unknown";
}
