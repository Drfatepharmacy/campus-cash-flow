// Formula-injection protection for CSV/Excel exports.
export function safeCell<T>(v: T): T | string {
  if (typeof v !== "string") return v;
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}
export function csvCell(v: unknown): string {
  return `"${String(safeCell(v ?? "")).replaceAll('"', '""')}"`;
}
