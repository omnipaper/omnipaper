// Check if the bucket allows anonymous GETs: 401/403 → private, 200/404 → public, else unknown.
// Public buckets let anyone with the URL read files; warn, but never block.

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
