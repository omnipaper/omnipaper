import { defineRule, type ESTree } from "@oxlint/plugins";

const MAX_PARAMS = 3;

// Only named functions are checked. Inline callbacks get their shape from the library that calls
// them (e.g. TanStack Query's onError(error, variables, context)), so they can't take an object.
export const maxPositionalParams = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: `Require an options object instead of more than ${MAX_PARAMS} positional parameters.`,
    },
  },
  create(context) {
    const check = (node: ESTree.Node, name: string, params: ESTree.Node[]) => {
      if (params.length <= MAX_PARAMS) return;
      context.report({
        node,
        message: `"${name}" takes ${params.length} positional parameters. Pass one options object instead.`,
      });
    };

    return {
      FunctionDeclaration(node) {
        if (node.id) check(node.id, node.id.name, node.params);
      },
      VariableDeclarator(node) {
        const init = node.init;
        if (node.id.type !== "Identifier" || !init) return;
        if (init.type !== "ArrowFunctionExpression" && init.type !== "FunctionExpression") return;
        check(node.id, node.id.name, init.params);
      },
    };
  },
});
