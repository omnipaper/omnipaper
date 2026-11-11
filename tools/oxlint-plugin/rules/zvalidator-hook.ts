import { defineRule } from "@oxlint/plugins";

export const zvalidatorHook = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Require onValidationError as zValidator's third argument.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== "Identifier" || node.callee.name !== "zValidator") return;
        if (node.arguments.length >= 3) return;
        context.report({
          node,
          message:
            "Pass onValidationError as zValidator's third argument so validation errors use the API error format.",
        });
      },
    };
  },
});
