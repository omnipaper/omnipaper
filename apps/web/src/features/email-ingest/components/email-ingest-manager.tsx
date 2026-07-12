import { Button } from "@omnipaper/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@omnipaper/ui/components/dialog";
import { Input } from "@omnipaper/ui/components/input";
import { Label } from "@omnipaper/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@omnipaper/ui/components/select";
import { Switch } from "@omnipaper/ui/components/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@omnipaper/ui/components/table";
import { Textarea } from "@omnipaper/ui/components/textarea";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { RowActions, TableEmptyRow } from "@/components/settings/settings-table";
import {
  type EmailIngestAccount,
  emailIngestAccountsQuery,
  useDeleteEmailIngestAccount,
  usePollEmailIngestAccountNow,
  useSetEmailIngestAccountEnabled,
  useTestEmailIngestConnection,
  useUpsertEmailIngestAccount,
} from "@/features/email-ingest/queries/email-ingest";
import { formatRelativeDay } from "@/lib/format";

const SECURITY_OPTIONS = [
  { value: "ssl", label: "SSL/TLS" },
  { value: "starttls", label: "STARTTLS" },
  { value: "none", label: "None" },
] as const;

const POST_ACTION_OPTIONS = [
  { value: "mark_seen", label: "Mark as read" },
  { value: "delete", label: "Delete from mailbox" },
  { value: "none", label: "Leave untouched" },
] as const;

const DEFAULT_PORTS = { ssl: "993", starttls: "143", none: "143" } as const;

function StatusCell({ account }: { account: EmailIngestAccount }) {
  if (!account.lastPolledAt) {
    return <span className="text-muted-foreground">Not polled yet</span>;
  }

  const polled = formatRelativeDay(account.lastPolledAt);

  if (account.lastError) {
    return (
      <span className="text-destructive" title={account.lastError}>
        Error ({polled})
      </span>
    );
  }

  return (
    <span className="text-muted-foreground" title={account.lastStatus ?? undefined}>
      {account.lastStatus?.startsWith("ok") ? `OK (${polled})` : (account.lastStatus ?? polled)}
    </span>
  );
}

export function EmailIngestManager({ orgId }: { orgId: string }) {
  const { data, isPending, isError } = useQuery(emailIngestAccountsQuery({ orgId }));
  const deleteAccount = useDeleteEmailIngestAccount(orgId);
  const setEnabled = useSetEmailIngestAccountEnabled(orgId);
  const pollNow = usePollEmailIngestAccountNow(orgId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmailIngestAccount | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(account: EmailIngestAccount) {
    setEditing(account);
    setDialogOpen(true);
  }

  const accounts = data?.accounts ?? [];
  const columnCount = 5;

  let body: ReactNode;
  if (isPending) {
    body = (
      <TableEmptyRow colSpan={columnCount}>
        <Loader2Icon className="mx-auto size-5 animate-spin text-muted-foreground/50" />
      </TableEmptyRow>
    );
  } else if (isError) {
    body = (
      <TableEmptyRow colSpan={columnCount} className="text-destructive">
        Failed to load email accounts.
      </TableEmptyRow>
    );
  } else if (accounts.length === 0) {
    body = (
      <TableEmptyRow colSpan={columnCount}>
        No email accounts yet. Connect a mailbox to ingest attachments automatically.
      </TableEmptyRow>
    );
  } else {
    body = accounts.map((account) => (
      <TableRow key={account.id}>
        <TableCell className="font-medium">{account.label}</TableCell>
        <TableCell className="text-muted-foreground">
          <span className="line-clamp-1">
            {account.username} ({account.host}, {account.folder})
          </span>
        </TableCell>
        <TableCell>
          <StatusCell account={account} />
        </TableCell>
        <TableCell className="text-center">
          <Switch
            checked={account.enabled}
            onCheckedChange={(next) => setEnabled.mutate({ id: account.id, enabled: next })}
            aria-label={`Enable ${account.label}`}
          />
        </TableCell>
        <TableCell className="text-right">
          <span className="inline-flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => pollNow.mutate(account.id)}
              disabled={!account.enabled || pollNow.isPending}
              aria-label={`Poll ${account.label} now`}
              title="Poll now"
            >
              <RefreshCwIcon />
            </Button>
            <RowActions
              onEdit={() => openEdit(account)}
              onDelete={() => deleteAccount.mutate(account.id)}
              disabled={deleteAccount.isPending}
              deleteTitle={`Delete “${account.label}”?`}
              deleteDescription="Stops polling this mailbox. Already-ingested documents are kept. This can't be undone."
            />
          </span>
        </TableCell>
      </TableRow>
    ));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button onClick={openCreate}>
          <PlusIcon />
          Connect mailbox
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg bg-card border border-border/50 shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Label</TableHead>
              <TableHead>Mailbox</TableHead>
              <TableHead>Last poll</TableHead>
              <TableHead className="w-24 text-center">Enabled</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>{body}</TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="max-h-[90svh] overflow-y-auto sm:max-w-lg"
          onInteractOutside={(e) => e.preventDefault()}
        >
          {dialogOpen ? (
            <EmailAccountDialogBody
              orgId={orgId}
              editing={editing}
              onDone={() => setDialogOpen(false)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmailAccountDialogBody({
  orgId,
  editing,
  onDone,
}: {
  orgId: string;
  editing: EmailIngestAccount | null;
  onDone: () => void;
}) {
  const [label, setLabel] = useState(editing?.label ?? "");
  const [host, setHost] = useState(editing?.host ?? "");
  const [port, setPort] = useState(editing ? String(editing.port) : DEFAULT_PORTS.ssl);
  const [security, setSecurity] = useState<"ssl" | "starttls" | "none">(editing?.security ?? "ssl");
  const [username, setUsername] = useState(editing?.username ?? "");
  // Pre-filled with the opaque mask on edit (same round-trip as OCR/AI keys): sending it back
  // unchanged keeps the stored password, typing over it replaces it.
  const [password, setPassword] = useState(editing?.password ?? "");
  const [folder, setFolder] = useState(editing?.folder ?? "INBOX");
  const [allowedSenders, setAllowedSenders] = useState(editing?.allowedSenders.join("\n") ?? "");
  const [filenameGlob, setFilenameGlob] = useState(editing?.filenameGlob ?? "");
  const [postAction, setPostAction] = useState<"mark_seen" | "delete" | "none">(
    editing?.postAction ?? "mark_seen",
  );
  // Open Advanced up front when editing an account with non-default advanced values, so they show.
  const [showAdvanced, setShowAdvanced] = useState(
    editing
      ? editing.folder !== "INBOX" ||
          editing.allowedSenders.length > 0 ||
          editing.filenameGlob !== null ||
          editing.postAction !== "mark_seen"
      : false,
  );

  const upsert = useUpsertEmailIngestAccount(orgId);
  const test = useTestEmailIngestConnection(orgId);

  const portNumber = Number.parseInt(port, 10);
  const connectionValid = host.trim() && username.trim() && portNumber > 0 && portNumber <= 65535;
  const formValid = connectionValid && label.trim() && password.length > 0;

  function parsedSenders(): string[] {
    return allowedSenders
      .split(/[\n,]/)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
  }

  function changeSecurity(next: "ssl" | "starttls" | "none") {
    // Follow the conventional port unless the admin typed a custom one.
    if (port === DEFAULT_PORTS[security]) {
      setPort(DEFAULT_PORTS[next]);
    }
    setSecurity(next);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit mailbox" : "Connect mailbox"}</DialogTitle>
        <DialogDescription>
          Attachments from new emails in this mailbox are ingested as documents. Use a dedicated
          mailbox and an app password.
        </DialogDescription>
      </DialogHeader>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!formValid) return;
          upsert.mutate(
            {
              id: editing?.id,
              label: label.trim(),
              host: host.trim(),
              port: portNumber,
              security,
              username: username.trim(),
              password,
              folder: folder.trim() || "INBOX",
              allowedSenders: parsedSenders(),
              filenameGlob: filenameGlob.trim() || null,
              postAction,
              enabled: editing?.enabled ?? true,
            },
            { onSuccess: onDone },
          );
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="mail-label">Label</Label>
          <Input
            id="mail-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            maxLength={100}
            placeholder="e.g. Invoices inbox"
            autoFocus
            required
          />
        </div>

        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="mail-host">IMAP server</Label>
            <Input
              id="mail-host"
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="imap.example.com"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="mail-port">Port</Label>
            <Input
              id="mail-port"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              inputMode="numeric"
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="mail-security">Security</Label>
          <Select value={security} onValueChange={(v) => changeSecurity(v as typeof security)}>
            <SelectTrigger id="mail-security" className="w-full">
              <SelectValue>{SECURITY_OPTIONS.find((o) => o.value === security)?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SECURITY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="mail-username">Username</Label>
          <Input
            id="mail-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="mailbox@example.com"
            autoComplete="off"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="mail-password">Password</Label>
          <Input
            id="mail-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </div>

        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-fit items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
          >
            {showAdvanced ? (
              <ChevronDownIcon className="size-3" />
            ) : (
              <ChevronRightIcon className="size-3" />
            )}
            Advanced settings
          </button>
          {showAdvanced ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="mail-folder">Folder</Label>
                <Input
                  id="mail-folder"
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="mail-senders">Allowed senders (optional)</Label>
                <Textarea
                  id="mail-senders"
                  value={allowedSenders}
                  onChange={(e) => setAllowedSenders(e.target.value)}
                  placeholder={"accounting@company.com\n@trusted-domain.com"}
                  rows={3}
                />
                <p className="text-muted-foreground text-xs">
                  One address or @domain per line. When empty, emails from anyone are processed.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="mail-glob">Attachment name filter (optional)</Label>
                <Input
                  id="mail-glob"
                  value={filenameGlob}
                  onChange={(e) => setFilenameGlob(e.target.value)}
                  placeholder="*.pdf, *invoice*"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="mail-post-action">After processing</Label>
                <Select
                  value={postAction}
                  onValueChange={(v) => setPostAction(v as typeof postAction)}
                >
                  <SelectTrigger id="mail-post-action" className="w-full">
                    <SelectValue>
                      {POST_ACTION_OPTIONS.find((o) => o.value === postAction)?.label}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {POST_ACTION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={!connectionValid || test.isPending || !password}
            onClick={() =>
              test.mutate({
                host: host.trim(),
                port: portNumber,
                security,
                username: username.trim(),
                // The mask round-trips here too; the server swaps it for the stored password.
                password,
                folder: folder.trim() || "INBOX",
                accountId: editing?.id,
              })
            }
          >
            {test.isPending ? "Testing…" : "Test connection"}
          </Button>
          <span className="flex gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={upsert.isPending || !formValid}>
              {upsert.isPending ? "Saving…" : editing ? "Save changes" : "Connect"}
            </Button>
          </span>
        </DialogFooter>
      </form>
    </>
  );
}
