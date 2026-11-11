import { Button } from "@omnipaper/ui/components/button";
import { Loader2Icon, SparklesIcon } from "lucide-react";

// Sits next to a Description label. With an empty field it writes one from the name; with a draft it
// rewrites the draft. Either way the server matches the style of the other rows in the same list.
export function AiDescriptionButton({
  hasDraft,
  disabled,
  pending,
  onClick,
}: {
  hasDraft: boolean;
  disabled: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-my-1 h-auto py-1 text-muted-foreground"
      disabled={disabled || pending}
      onClick={onClick}
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
      {hasDraft ? "Improve with AI" : "Generate with AI"}
    </Button>
  );
}
