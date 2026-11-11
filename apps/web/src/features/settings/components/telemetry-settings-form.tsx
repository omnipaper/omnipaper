import { Card, CardContent, CardHeader, CardTitle } from "@omnipaper/ui/components/card";
import { Label } from "@omnipaper/ui/components/label";
import { Switch } from "@omnipaper/ui/components/switch";
import { useQuery } from "@tanstack/react-query";
import {
  telemetrySettingsQuery,
  useSaveTelemetrySettings,
} from "@/features/settings/queries/settings";

export function TelemetrySettingsForm() {
  const telemetryQuery = useQuery(telemetrySettingsQuery());
  const toggleMutation = useSaveTelemetrySettings();

  const enabled = telemetryQuery.data?.enabled ?? true;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Telemetry</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="telemetry-enabled">Share anonymous usage statistics</Label>
            <p className="text-xs/relaxed text-muted-foreground">
              Basic, anonymous numbers such as monthly AI token usage help us improve Omnipaper.
              Document contents are never included. Nothing is sent yet.
            </p>
          </div>
          <Switch
            id="telemetry-enabled"
            checked={enabled}
            disabled={telemetryQuery.isLoading || toggleMutation.isPending}
            onCheckedChange={(next) => toggleMutation.mutate(next)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
