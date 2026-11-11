import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";

const pluginEntry = resolve(import.meta.dir, "../plugin.ts");
const oxlintBin = resolve(import.meta.dir, "../../../node_modules/.bin/oxlint");

const oxlintOutputSchema = z.object({
  diagnostics: z.array(z.object({ code: z.string(), message: z.string() })),
});

export type Diagnostic = z.infer<typeof oxlintOutputSchema>["diagnostics"][number];

// Runs the real oxlint binary with only the rule under test enabled, so tests exercise the same
// plugin loading path as `bun run lint`.
export function lintFixture(options: {
  rule: string;
  source: string;
  filename?: string;
}): Diagnostic[] {
  const dir = mkdtempSync(join(tmpdir(), "oxlint-fixture-"));
  try {
    const file = join(dir, options.filename ?? "fixture.ts");
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, options.source);

    const config = join(dir, ".oxlintrc.json");
    writeFileSync(
      config,
      JSON.stringify({
        jsPlugins: [pluginEntry],
        categories: { correctness: "off" },
        rules: { [`omnipaper/${options.rule}`]: "error" },
      }),
    );

    const result = Bun.spawnSync([oxlintBin, "--format=json", "-c", config, file], { cwd: dir });
    return oxlintOutputSchema.parse(JSON.parse(result.stdout.toString())).diagnostics;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
