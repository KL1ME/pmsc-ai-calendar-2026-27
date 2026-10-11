import assert from "node:assert/strict";
import test from "node:test";
import { athensDateTime, parseDeadlineFeed, trustedMessage, validMonitorOrigin, mergeEvents, deadlinesICS } from "../app/moodle-deadlines.ts";

const event = { id: "moodle-assignment-1-2", title: "Δοκιμαστική εργασία", course: "Δοκιμαστικό μάθημα",
  deadlineAt: "2026-10-14T20:59:00Z", date: "2026-10-14", startTime: "23:59",
  url: "https://digitaltransformation-edu.dmst.aueb.gr/mod/assign/view.php?id=3" };
const feed = (events = [event]) => ({ schema: "aueb-moodle-deadlines/v1", events, checkedAt: "2026-10-11T10:00:00Z",
  withoutDue: 0, outsidePeriod: 0, incomplete: false, timezone: "Europe/Athens" });

test("Athens deadlines retain exact local date and time across DST", () => {
  assert.deepEqual(athensDateTime("2026-10-14T20:59:00Z"), { date: "2026-10-14", time: "23:59" });
  assert.deepEqual(athensDateTime("2026-12-14T22:30:00Z"), { date: "2026-12-15", time: "00:30" });
  const parsed = parseDeadlineFeed(feed());
  assert.equal(parsed.events[0].category, "Παράδοση εργασίας");
  assert.equal(parsed.events[0].allDay, false);
});

test("reject unsafe links, duplicate IDs, mismatched dates, and out-of-period deadlines", () => {
  for (const changes of [{ url: "javascript:alert(1)" }, { url: event.url + "&token=secret" },
    { date: "2026-10-15" }, { startTime: "23:00" }, { deadlineAt: "2025-10-14T20:59:00Z", date: "2025-10-14" }]) {
    assert.throws(() => parseDeadlineFeed(feed([{ ...event, ...changes }])));
  }
  assert.throws(() => parseDeadlineFeed(feed([event, event])));
  assert.throws(() => parseDeadlineFeed({ ...feed(), schema: "unknown" }));
  const parsed = parseDeadlineFeed({ ...feed(), token: "secret", events: [{ ...event, description: "private description" }] });
  assert.equal(JSON.stringify(parsed).includes("secret"), false);
  assert.equal(JSON.stringify(parsed).includes("private description"), false);
});

test("bridge requires exact loopback origin, source window and pairing nonce", () => {
  const source = {}, connection = { origin: "http://127.0.0.1:8765", source, session: "pairing" };
  const message = { origin: connection.origin, source, data: { session: "pairing" } };
  assert.equal(trustedMessage(message, connection), true);
  for (const changed of [{ origin: "https://evil.test" }, { source: {} }, { data: { session: "wrong" } }]) {
    assert.equal(trustedMessage({ ...message, ...changed }, connection), false);
  }
  for (const origin of ["http://127.0.0.1.evil.test:8765", "http://localhost:8765", "http://127.0.0.1:8765/path", "http://127.0.0.1:80"]) {
    assert.equal(validMonitorOrigin(origin), false);
  }
});

test("a changed or removed deadline replaces the snapshot without changing timetable", () => {
  const base = [{ ...event, id: "class-1", category: "Μάθημα" }], original = structuredClone(base);
  const first = parseDeadlineFeed(feed());
  const updated = parseDeadlineFeed(feed([{ ...event, deadlineAt: "2026-10-15T20:59:00Z", date: "2026-10-15" }]));
  assert.equal(mergeEvents(base, first).length, 2);
  const result = mergeEvents(base, updated);
  assert.equal(result.filter(item => item.id === event.id).length, 1);
  assert.equal(result.find(item => item.id === event.id).date, "2026-10-15");
  assert.equal(mergeEvents(base, parseDeadlineFeed(feed([]))).length, 1);
  assert.deepEqual(base, original);
});

test("ICS uses UTC and stable IDs, escapes text, and folds UTF-8 lines", () => {
  const parsed = parseDeadlineFeed(feed([{ ...event, title: "Γραμμή, ένα;\n" + "Ελληνικά ".repeat(20) }]));
  const ics = deadlinesICS(parsed.events, new Date("2026-10-11T10:00:00Z"));
  assert.ok(ics.includes("DTSTART:20261014T205900Z\r\n"));
  assert.ok(ics.includes("UID:moodle-assignment-1-2@moodle-notifier.local"));
  assert.ok(ics.replace(/\r\n /g, "").includes("Γραμμή\\, ένα\\;\\n"));
  assert.ok(ics.split("\r\n").every(line => Buffer.byteLength(line) <= 75));
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 1);
});
