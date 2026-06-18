import { UPLOAD_FORMATS } from "@omnipaper/shared/formats";

const MEDIUM_DATE = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
export function formatInstantDate(value: string | Date): string {
  return MEDIUM_DATE.format(new Date(value));
}
// "today" / "N days ago" for the last week, then the absolute date. Counted by LOCAL calendar day,
// so "1 day ago" means yesterday regardless of the time of day. Used for the "Added" row metadata.
export function formatRelativeDay(value: string | Date): string {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(new Date(value))) / 86_400_000);
  if (days <= 0) {
    return "today";
  }
  if (days <= 7) {
    return days === 1 ? "1 day ago" : `${days} days ago`;
  }
  return formatInstantDate(value);
}
export function formatCalendarDate(value: string): string {
  return MEDIUM_DATE.format(new Date(`${value}T00:00:00`));
}
export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
export function fileTypeLabel(mimeType: string): string {
  return (
    UPLOAD_FORMATS.find((format) => format.mimeTypes.some((m) => m === mimeType))?.label ?? mimeType
  );
}
