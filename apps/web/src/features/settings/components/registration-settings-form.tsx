import { Card, CardContent, CardHeader, CardTitle } from "@omnipaper/ui/components/card";
import { Label } from "@omnipaper/ui/components/label";
import { Switch } from "@omnipaper/ui/components/switch";
import { useQuery } from "@tanstack/react-query";
import {
  registrationSettingsQuery,
  useSaveRegistrationSettings,
} from "@/features/settings/queries/settings";

export function RegistrationSettingsForm() {
  const registrationQuery = useQuery(registrationSettingsQuery());
  const toggleMutation = useSaveRegistrationSettings();

  const enabled = registrationQuery.data?.enabled ?? false;

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Registration</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="registration-enabled">Allow self-service sign-up</Label>
            <p className="text-xs/relaxed text-muted-foreground">
              When off, the sign-up page shows “Registration is disabled by an instance admin.”
            </p>
          </div>
          <Switch
            id="registration-enabled"
            checked={enabled}
            disabled={registrationQuery.isLoading || toggleMutation.isPending}
            onCheckedChange={(next) => toggleMutation.mutate(next)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
