import { Button } from "@omnipaper/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@omnipaper/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@omnipaper/ui/components/table";
import { CheckCircle2Icon } from "lucide-react";
import type { MigrationDto, MigrationReport } from "@/features/migration/queries/migrations";

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex flex-col">
      <span className={tone ? `font-semibold text-lg ${tone}` : "font-semibold text-lg"}>
        {value}
      </span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}

export function MigrationReportStep({
  migration,
  onReset,
}: {
  migration: MigrationDto;
  onReset: () => void;
}) {
  const report = migration.report as MigrationReport | null;
  const errors = report?.errors ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2Icon className="size-5 text-emerald-600 dark:text-emerald-400" />
          Migration complete
        </CardTitle>
        <CardDescription>Your Paperless documents have been imported.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          <Stat
            label="Imported"
            value={report?.imported ?? migration.docsImported}
            tone="text-emerald-600 dark:text-emerald-400"
          />
          <Stat label="Skipped as duplicate" value={report?.duplicate ?? migration.docsDuplicate} />
          <Stat
            label="Failed"
            value={report?.failed ?? migration.docsFailed}
            tone={(report?.failed ?? migration.docsFailed) > 0 ? "text-destructive" : undefined}
          />
        </div>

        {errors.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="font-medium text-sm">Documents that couldn't be imported</p>
            <div className="max-h-72 overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errors.map((e) => (
                    <TableRow key={`${e.sourceId}:${e.fileRef}`}>
                      <TableCell className="font-mono text-xs">{e.fileRef}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{e.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}

        <Button variant="outline" className="self-start" onClick={onReset}>
          Start another migration
        </Button>
      </CardContent>
    </Card>
  );
}
