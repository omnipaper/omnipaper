import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@omnipaper/ui/components/card";
import { Label } from "@omnipaper/ui/components/label";
import { Switch } from "@omnipaper/ui/components/switch";
import { useQuery } from "@tanstack/react-query";
import { aiModelUpdatesQuery, useSaveAiModelUpdates } from "@/features/settings/queries/settings";

export function AiModelUpdatesCard() {
  const settings = useQuery(aiModelUpdatesQuery());
  const save = useSaveAiModelUpdates();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Model list</CardTitle>
        <CardDescription>Applies to every organization on this instance.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="ai-model-updates">Fetch model list updates</Label>
            <p className="text-muted-foreground text-xs">
              Checks the Omnipaper GitHub repository hourly so new models show up without updating
              Omnipaper. When off, the list only changes with a new release.
            </p>
          </div>
          <Switch
            id="ai-model-updates"
            checked={settings.data?.enabled ?? true}
            disabled={settings.isPending || save.isPending}
            onCheckedChange={(next) => save.mutate(next)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
