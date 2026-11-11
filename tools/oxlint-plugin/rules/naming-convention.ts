import { defineRule, type ESTree } from "@oxlint/plugins";

// Checks only names this codebase chooses. Object and type members are skipped because they
// mirror outside contracts (env vars, S3 params, provider APIs, AI tool names).
const CAMEL = /^[a-z][a-zA-Z0-9]*$/;
const PASCAL = /^[A-Z][a-zA-Z0-9]*$/;
const CONSTANT = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

type Case = "camelCase" | "PascalCase" | "CONSTANT_CASE";

function matches(name: string, allowed: Case[]): boolean {
  const bare = name.replace(/^_+/, "");
  if (bare === "") return true;
  return allowed.some((style) => {
    if (style === "camelCase") return CAMEL.test(bare);
    if (style === "PascalCase")
      return PASCAL.test(bare) && (bare.length === 1 || /[a-z]/.test(bare));
    return CONSTANT.test(bare);
  });
}

function isTopLevel(declaration: ESTree.Node): boolean {
  const parent = declaration.parent;
  if (parent?.type === "Program") return true;
  return parent?.type === "ExportNamedDeclaration" && parent.parent?.type === "Program";
}

export const namingConvention = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Enforce camelCase/PascalCase/CONSTANT_CASE for names declared in this codebase.",
    },
  },
  create(context) {
    const check = (node: ESTree.Node, name: string, allowed: Case[]) => {
      if (matches(name, allowed)) return;
      context.report({ node, message: `"${name}" should be ${allowed.join(" or ")}.` });
    };

    const checkParams = (params: ESTree.Node[]) => {
      for (const param of params) {
        const target = param.type === "AssignmentPattern" ? param.left : param;
        if (target.type === "Identifier") check(target, target.name, ["camelCase", "PascalCase"]);
      }
    };

    return {
      VariableDeclarator(node) {
        if (node.id.type !== "Identifier") return;
        const declaration = node.parent;
        const topLevelConst =
          declaration.type === "VariableDeclaration" &&
          declaration.kind === "const" &&
          isTopLevel(declaration);
        check(
          node.id,
          node.id.name,
          topLevelConst
            ? ["camelCase", "PascalCase", "CONSTANT_CASE"]
            : ["camelCase", "PascalCase"],
        );
      },
      FunctionDeclaration(node) {
        if (node.id) check(node.id, node.id.name, ["camelCase", "PascalCase"]);
        checkParams(node.params);
      },
      FunctionExpression(node) {
        checkParams(node.params);
      },
      ArrowFunctionExpression(node) {
        checkParams(node.params);
      },
      TSTypeAliasDeclaration(node) {
        check(node.id, node.id.name, ["PascalCase"]);
      },
      TSInterfaceDeclaration(node) {
        check(node.id, node.id.name, ["PascalCase"]);
      },
      TSEnumDeclaration(node) {
        check(node.id, node.id.name, ["PascalCase"]);
      },
      TSTypeParameter(node) {
        check(node.name, node.name.name, ["PascalCase"]);
      },
    };
  },
});
