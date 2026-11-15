import { defineRule } from "@oxlint/plugins";

const MAX_RATIO = 0.12;
// A small file can carry one short why-comment without tripping the ratio.
const FREE_COMMENT_LINES = 3;
const DIRECTIVE_PATTERN = /^\s*(?:(?:oxlint|eslint)-|@ts-|prettier-ignore|biome-ignore)/u;

export const maxCommentDensity = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: `Keep comment-only lines at or below ${MAX_RATIO * 100}% of a file's non-blank lines.`,
    },
  },
  create(context) {
    const { sourceCode } = context;

    return {
      Program(node) {
        const { lines } = sourceCode;
        const commentLines = new Set<number>();

        for (const comment of sourceCode.getAllComments()) {
          if (DIRECTIVE_PATTERN.test(comment.value)) continue;
          const { start, end } = comment.loc;
          // Trailing comments after code on the same line don't make that line a comment line.
          const startsLine = (lines[start.line - 1] ?? "").slice(0, start.column).trim() === "";
          for (let line = startsLine ? start.line : start.line + 1; line <= end.line; line++) {
            commentLines.add(line);
          }
        }

        const nonBlank = lines.filter((line) => line.trim() !== "").length;
        const allowed = Math.max(FREE_COMMENT_LINES, Math.floor(nonBlank * MAX_RATIO));
        if (commentLines.size <= allowed) return;

        context.report({
          node,
          loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 0 } },
          message: `${commentLines.size} of ${nonBlank} lines are comments; the limit here is ${allowed}. Keep only the comments that explain a non-obvious why.`,
        });
      },
    };
  },
});
