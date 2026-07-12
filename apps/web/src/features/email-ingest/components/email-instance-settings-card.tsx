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
import {
  emailInstanceSettingsQuery,
  useSaveEmailInstanceSettings,
} from "@/features/email-ingest/queries/email-instance-settings";

// Instance admins only — the parent page renders this conditionally.
export function EmailInstanceSettingsCard() {
  const settings = useQuery(emailInstanceSettingsQuery());
  const save = useSaveEmailInstanceSettings();

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Instance settings</CardTitle>
        <CardDescription>Applies to every organization on this instance.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="allow-internal-hosts">Allow internal mail hosts</Label>
            <p className="text-muted-foreground text-xs">
              Permit IMAP servers on private networks (127.x, 10.x, 192.168.x). Turn this on for
              self-hosted setups with a LAN mail server; keep it off on public deployments.
            </p>
          </div>
          <Switch
            id="allow-internal-hosts"
            checked={settings.data?.allowInternalHosts ?? false}
            disabled={settings.isPending || save.isPending}
            onCheckedChange={(next) => save.mutate({ allowInternalHosts: next })}
          />
        </div>
      </CardContent>
    </Card>
  );
}
