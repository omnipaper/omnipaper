import { docs } from "collections/server";
import { loader } from "fumadocs-core/source";
import { lucideIconsPlugin } from "fumadocs-core/source/lucide-icons";

// Docs live at the domain root (docs.omnipaper.app), not under a /docs prefix.
export const source = loader({
  source: docs.toFumadocsSource(),
  baseUrl: "/",
  plugins: [lucideIconsPlugin()],
});

export function markdownPathToSlugs(segs: string[]): string[] {
  const out = segs.map((seg, i) => (i === segs.length - 1 ? seg.replace(/\.md$/, "") : seg));
  if (out.length === 1 && out[0] === "index") return [];
  return out;
}

export function slugsToMarkdownPath(slugs: string[]) {
  const segments =
    slugs.length === 0
      ? ["index.md"]
      : slugs.map((slug, i) => (i === slugs.length - 1 ? `${slug}.md` : slug));

  return {
    segments,
    url: `/${segments.join("/")}`,
  };
}

export async function getLLMText(page: (typeof source)["$inferPage"]) {
  const processed = await page.data.getText("processed");

  return `# ${page.data.title} (${page.url})

${processed}`;
}
