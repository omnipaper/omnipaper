import { defineRule } from "@oxlint/plugins";

// oxc/no-barrel-file only counts `export *`; this covers `export { x } from "./y"`. Type-only
// re-exports are erased at compile time, so they load nothing and stay allowed.
export const noNamedReexport = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow re-exporting values from another module.",
    },
  },
  create(context) {
    return {
      ExportNamedDeclaration(node) {
        if (!node.source || node.exportKind === "type") return;
        if (node.specifiers.every((specifier) => specifier.exportKind === "type")) return;
        context.report({
          node,
          message: "Import from the concrete module instead of re-exporting it (no barrel files).",
        });
      },
    };
  },
});
