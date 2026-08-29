import { Button } from "@omnipaper/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@omnipaper/ui/components/dialog";
import { Input } from "@omnipaper/ui/components/input";
import { Label } from "@omnipaper/ui/components/label";
import { useNavigate } from "@tanstack/react-router";
import { type SubmitEvent, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/features/auth/auth-client";
import { sessionKeys } from "@/features/auth/queries/session";
import { queryClient } from "@/lib/query-client";

type CreateOrgDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateOrgDialog({ open, onOpenChange }: CreateOrgDialogProps) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  async function handleCreate(event: SubmitEvent) {
    event.preventDefault();
    setPending(true);

    const { data, error } = await authClient.organization.create({
      name: name.trim(),
      // Slug isn't surfaced (orgs are keyed by id in the URL), so a random one avoids collisions.
      slug: crypto.randomUUID(),
    });

    if (error || !data) {
      setPending(false);
      toast.error(error?.message ?? "Could not create organization");
      return;
    }

    setPending(false);
    onOpenChange(false);
    setName("");
    await queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    navigate({ to: "/dashboard/orgs/$orgId", params: { orgId: data.id } });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create organization</DialogTitle>
          <DialogDescription>Give your new workspace a name.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-org-name">Name</Label>
            <Input
              id="new-org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Inc."
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
