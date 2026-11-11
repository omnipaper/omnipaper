import { definePlugin } from "@oxlint/plugins";
import { maxPositionalParams } from "./rules/max-positional-params.ts";
import { namingConvention } from "./rules/naming-convention.ts";
import { noLowValueComments } from "./rules/no-low-value-comments.ts";
import { noNamedReexport } from "./rules/no-named-reexport.ts";
import { zvalidatorHook } from "./rules/zvalidator-hook.ts";

export default definePlugin({
  meta: { name: "omnipaper" },
  rules: {
    "max-positional-params": maxPositionalParams,
    "naming-convention": namingConvention,
    "no-low-value-comments": noLowValueComments,
    "no-named-reexport": noNamedReexport,
    "zvalidator-hook": zvalidatorHook,
  },
});
