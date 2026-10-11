import type { CalendarEvent } from "./calendar-data";

export const DEADLINE_CATEGORY = "Παράδοση εργασίας";
export const DEADLINE_STORAGE = "aueb-private-moodle-deadlines-v1";
export type DeadlineFeed = {
  schema: "aueb-moodle-deadlines/v1";
  events: CalendarEvent[];
  checkedAt: string | null;
  withoutDue: number;
  outsidePeriod: number;
  incomplete: boolean;
  timezone: "Europe/Athens";
  period: { start: "2026-09-01"; end: "2027-07-01" };
};
export type Connection = { origin: string; source: unknown; session: string };

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Μη έγκυρα δεδομένα ημερολογίου.");
  return value as Record<string, unknown>;
}
function text(value: unknown, max = 1000): string {
  if (typeof value !== "string" || value.length > max) throw new Error("Μη έγκυρο κείμενο ημερολογίου.");
  return value;
}
function timestamp(value: unknown): string {
  const result = text(value, 40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(result) || !Number.isFinite(Date.parse(result))) {
    throw new Error("Μη έγκυρη ημερομηνία Moodle.");
  }
  return result;
}
export function athensDateTime(value: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Athens", year: "numeric",
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const get = (type: string) => parts.find(part => part.type === type)?.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}
export function parseDeadlineFeed(value: unknown): DeadlineFeed {
  const feed = object(value), seen = new Set<string>();
  if (feed.schema !== "aueb-moodle-deadlines/v1" || feed.timezone !== "Europe/Athens"
      || !Array.isArray(feed.events) || feed.events.length > 2000) throw new Error("Μη συμβατή καταγραφή Moodle.");
  const events = feed.events.map(raw => {
    const event = object(raw), id = text(event.id, 100), deadlineAt = timestamp(event.deadlineAt);
    const local = athensDateTime(deadlineAt), url = text(event.url, 300);
    if (!/^moodle-assignment-\d+-\d+$/.test(id) || seen.has(id)
        || local.date < "2026-09-01" || local.date >= "2027-07-01"
        || event.date !== local.date || event.startTime !== local.time
        || !/^https:\/\/digitaltransformation-edu\.dmst\.aueb\.gr\/mod\/assign\/view\.php\?id=\d+$/.test(url)) {
      throw new Error("Μη έγκυρη προθεσμία ή σύνδεσμος Moodle.");
    }
    seen.add(id);
    return { id, title: text(event.title), course: text(event.course, 2000), date: local.date,
      endDate: local.date, startTime: local.time, endTime: "", allDay: false, location: "",
      category: DEADLINE_CATEGORY, url, deadlineAt };
  });
  const count = (value: unknown) => {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100000) throw new Error("Μη έγκυρη καταγραφή Moodle.");
    return value;
  };
  return { schema: "aueb-moodle-deadlines/v1", events,
    checkedAt: feed.checkedAt === null ? null : timestamp(feed.checkedAt),
    withoutDue: count(feed.withoutDue), outsidePeriod: count(feed.outsidePeriod), incomplete: feed.incomplete !== false,
    timezone: "Europe/Athens", period: { start: "2026-09-01", end: "2027-07-01" } };
}
export function validMonitorOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "http:" && url.hostname === "127.0.0.1" && Number(url.port) >= 1024
      && Number(url.port) <= 65535 && url.origin === origin;
  } catch { return false; }
}
export function trustedMessage(event: { origin: string; source: unknown; data: unknown }, connection: Connection): boolean {
  if (event.origin !== connection.origin || event.source !== connection.source || !validMonitorOrigin(event.origin)) return false;
  return !!event.data && typeof event.data === "object" && (event.data as Record<string, unknown>).session === connection.session;
}
export function mergeEvents(base: CalendarEvent[], feed: DeadlineFeed | null): CalendarEvent[] {
  // The private snapshot replaces the previous one; changed deadlines cannot accumulate duplicates.
  return [...base, ...(feed?.events ?? [])].sort((a, b) => a.date.localeCompare(b.date)
    || a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id));
}
export function deadlinesICS(events: CalendarEvent[], now = new Date()): string {
  const utc = (value: string) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const escape = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AUEB Personal Calendar//Moodle Deadlines//EL", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Παραδόσεις εργασιών Moodle"];
  for (const event of events) {
    if (!event.deadlineAt) continue;
    lines.push("BEGIN:VEVENT", `UID:${event.id}@moodle-notifier.local`, `DTSTAMP:${utc(now.toISOString())}`,
      `DTSTART:${utc(event.deadlineAt)}`, `SUMMARY:${escape("Παράδοση: " + event.title)}`,
      `DESCRIPTION:${escape(event.course ?? "")}`, `URL:${event.url}`, "CATEGORIES:Παράδοση εργασίας", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  const encoder = new TextEncoder();
  return lines.flatMap(line => {
    const folded = []; let chunk = "", bytes = 0;
    for (const char of line) {
      const size = encoder.encode(char).length;
      if (bytes + size > 75) { folded.push(chunk); chunk = " "; bytes = 1; }
      chunk += char; bytes += size;
    }
    folded.push(chunk); return folded;
  }).join("\r\n") + "\r\n";
}
