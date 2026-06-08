import { registrationSettingsQuery, settingsKeys } from "@/features/settings/queries/settings";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@omnipaper/ui/components/card";
import { Label } from "@omnipaper/ui/components/label";
import { Switch } from "@omnipaper/ui/components/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function RegistrationSettingsForm() {
  const queryClient = useQueryClient();
  const registrationQuery = useQuery(registrationSettingsQuery());

  const enabled = registrationQuery.data?.enabled ?? false;

  const toggleMutation = useMutation({
    mutationFn: async (next: boolean) => {
      const res = await api.settings.registration.$put({ json: { enabled: next } });
      if (!res.ok) {
        throw new Error("Failed to update registration");
      }
      return res.json();
    },
    onSuccess: (_data, next) => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.registration() });
      toast.success(next ? "Registration enabled" : "Registration disabled");
    },
    onError: () => {
      toast.error("Save failed");
    },
  });

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Registration</CardTitle>
        <CardDescription>
          The first account ever created always becomes the instance admin, so you can bootstrap a
          new instance. Keep self-service sign-up off afterwards and only turn it on while you're
          onboarding someone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="registration-enabled">Allow self-service sign-up</Label>
            <p className="text-muted-foreground text-sm">
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
