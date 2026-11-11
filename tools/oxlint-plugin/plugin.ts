import { definePlugin } from "@oxlint/plugins";
import { namingConvention } from "./rules/naming-convention.ts";
import { noNamedReexport } from "./rules/no-named-reexport.ts";
import { zvalidatorHook } from "./rules/zvalidator-hook.ts";

export default definePlugin({
  meta: { name: "omnipaper" },
  rules: {
    "naming-convention": namingConvention,
    "no-named-reexport": noNamedReexport,
    "zvalidator-hook": zvalidatorHook,
  },
});
