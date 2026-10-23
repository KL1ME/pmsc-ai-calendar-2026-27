import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

function assertValidIsoDate(value, label) {
  assert.match(value, /^\d{4}-\d{2}-\d{2}$/, `${label} must use YYYY-MM-DD`);
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  assert.equal(parsed.getUTCFullYear(), year, `${label} has an invalid year`);
  assert.equal(parsed.getUTCMonth(), month - 1, `${label} has an invalid month`);
  assert.equal(parsed.getUTCDate(), day, `${label} is not a real calendar date`);
}

test("all web calendar dates are real dates", async () => {
  const source = await readFile(new URL("app/calendar-data.ts", root), "utf8");
  const marker = "export const calendarEvents: CalendarEvent[] = ";
  const start = source.indexOf(marker) + marker.length;
  const end = source.lastIndexOf("];");
  const events = JSON.parse(source.slice(start, end + 1));

  assert.ok(events.length >= 150, "calendar must retain the academic year");

  for (const event of events) {
    assertValidIsoDate(event.date, `${event.title} start date`);
    assertValidIsoDate(event.endDate, `${event.title} end date`);
    assert.ok(event.date <= event.endDate, `${event.title} ends before it starts`);
  }

  const timedEvents = events.filter((event) => !event.allDay);
  assert.ok(timedEvents.length >= 130);
});

test("all iCalendar dates are real dates", async () => {
  const ics = await readFile(
    new URL("public/pmsc-ai-digital-transformation-2026-27.ics", root),
    "utf8",
  );
  const dates = [...ics.matchAll(/^(?:DTSTART|DTEND)(?:;[^:]*)?:(\d{8})/gm)].map(
    (match) => match[1],
  );

  assert.ok(dates.length > 0);
  for (const value of dates) {
    assertValidIsoDate(
      `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`,
      `iCalendar date ${value}`,
    );
  }
});

test("public ICS active records match the web calendar and preserve cancellations", async () => {
  const source = await readFile(new URL("app/calendar-data.ts", root), "utf8");
  const events = JSON.parse(source.split("export const calendarEvents: CalendarEvent[] = ")[1].trim().replace(/;$/, ""));
  const ics = (await readFile(new URL("public/pmsc-ai-digital-transformation-2026-27.ics", root), "utf8")).replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  const blocks = [...ics.matchAll(/BEGIN:VEVENT\n([\s\S]*?)\nEND:VEVENT/g)].map(m => m[1]);
  const active = blocks.filter(b => !b.includes("STATUS:CANCELLED")).map(b => b.match(/^UID:([^@]+)@/m)[1]);
  assert.deepEqual(active.sort(), events.map(e => e.id).sort());
  assert.ok(blocks.some(b => b.includes("a3a9eba05a29ed2af3358296e678c6d0e73c15e6@") && b.includes("STATUS:CANCELLED")));
  const saturday = events.filter(e => e.date === "2026-10-24" && !e.allDay);
  assert.ok(saturday.some(e => e.title.includes("Digital Transformation") && e.startTime === "12:00" && e.location.includes("304")));
  assert.ok(!saturday.some(e => e.title.includes("Data Management")));
});
