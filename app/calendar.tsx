"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { calendarEvents, type CalendarEvent } from "./calendar-data";
import timetableRevision from "./timetable-revision.json";
import { athensDateTime, DEADLINE_CATEGORY, DEADLINE_STORAGE, deadlinesICS, mergeEvents,
  parseDeadlineFeed, trustedMessage, validMonitorOrigin, type Connection, type DeadlineFeed } from "./moodle-deadlines";

const monthNames = [
  "Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος",
  "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος",
];
const weekdays = ["Δευ", "Τρι", "Τετ", "Πεμ", "Παρ", "Σαβ", "Κυρ"];
const longDate = new Intl.DateTimeFormat("el-GR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const pad = (value: number) => String(value).padStart(2, "0");
const dateKey = (value: Date) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const localDate = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
};
const cleanTitle = (title: string) => title.replace(/^\[[^\]]+\]\s*/, "");
const kindLabel = (category: string) => {
  if (category === "Προπαρασκευαστικό") return "Προετοιμασία";
  if (category === "Εργαστήριο") return "Εργαστήριο";
  return category;
};

function eventsForDay(key: string, events: CalendarEvent[]) {
  return events.filter((event) => {
    if (event.category === "Ακαδημαϊκή περίοδος") return false;
    return event.allDay ? event.date <= key && key < event.endDate : event.date === key;
  });
}

function phaseForDay(key: string) {
  return calendarEvents.find(
    (event) => event.category === "Ακαδημαϊκή περίοδος" && event.date <= key && key < event.endDate,
  );
}

export default function CalendarApp() {
  const [month, setMonth] = useState(new Date(2026, 8, 1));
  const [selectedDate, setSelectedDate] = useState("2026-09-07");
  const [deadlines, setDeadlines] = useState<DeadlineFeed | null>(null);
  const [live, setLive] = useState(false);
  const [deadlineError, setDeadlineError] = useState("");
  const connection = useRef<Connection | null>(null);
  const receivedAt = useRef(0);
  const focused = useRef(false);
  const allEvents = useMemo(() => mergeEvents(calendarEvents, deadlines), [deadlines]);

  useEffect(() => {
    const focusDeadline = (feed: DeadlineFeed) => {
      if (focused.current || !feed.events.length) return;
      const today = athensDateTime(new Date().toISOString()).date;
      const event = feed.events.find(item => item.date >= today) ?? feed.events[0];
      const day = localDate(event.date);
      setMonth(new Date(day.getFullYear(), day.getMonth(), 1));
      setSelectedDate(event.date); focused.current = true;
    };
    try {
      const saved = localStorage.getItem(DEADLINE_STORAGE);
      if (saved) { const feed = parseDeadlineFeed(JSON.parse(saved)); setDeadlines(feed); focusDeadline(feed); }
    } catch { setDeadlineError("Η αποθηκευμένη καταγραφή δεν είναι διαθέσιμη. Σύνδεσε ξανά το Moodle Monitor."); }

    let pairing = location.hash.slice(1);
    try { pairing = pairing || sessionStorage.getItem("moodle-calendar-pairing") || ""; } catch { /* Storage is optional. */ }
    const fragment = new URLSearchParams(pairing);
    const origin = fragment.get("moodle-origin"), session = fragment.get("moodle-session");
    if (origin && session && validMonitorOrigin(origin) && /^[a-f0-9-]{36}$/.test(session) && window.opener) {
      connection.current = { origin, session, source: window.opener };
      try { sessionStorage.setItem("moodle-calendar-pairing", fragment.toString()); } catch { /* This connection still works. */ }
      // The fragment contains only a one-time pairing nonce, never Moodle credentials or data.
      history.replaceState(null, "", location.pathname + location.search);
    }
    const request = () => {
      const link = connection.current;
      if (link && window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: "moodle-calendar-ready", session: link.session }, link.origin);
      } else { setLive(false); }
      if (Date.now() - receivedAt.current > 90000) setLive(false);
    };
    const receive = (event: MessageEvent) => {
      const link = connection.current;
      if (!link || !trustedMessage(event, link)) return;
      if (event.data.type === "moodle-calendar-unavailable") {
        setLive(false); setDeadlineError("Το Moodle Monitor χρειάζεται σύνδεση. Εμφανίζεται η τελευταία καταγραφή."); return;
      }
      if (event.data.type !== "moodle-calendar-data") return;
      try {
        const feed = parseDeadlineFeed(event.data.payload);
        setDeadlines(feed); setLive(true); receivedAt.current = Date.now(); setDeadlineError(""); focusDeadline(feed);
        try { localStorage.setItem(DEADLINE_STORAGE, JSON.stringify(feed)); }
        catch { setDeadlineError("Οι παραδόσεις εμφανίζονται, αλλά δεν μπόρεσαν να αποθηκευτούν σε αυτόν τον browser."); }
      } catch { setDeadlineError("Δεν ήταν δυνατή η ανάγνωση των προθεσμιών. Η προηγούμενη καταγραφή διατηρήθηκε."); }
    };
    window.addEventListener("message", receive);
    request(); const timer = setInterval(request, 30000);
    return () => { window.removeEventListener("message", receive); clearInterval(timer); };
  }, []);

  const clearDeadlines = () => {
    const link = connection.current;
    if (link && window.opener) window.opener.postMessage({ type: "moodle-calendar-disconnect", session: link.session }, link.origin);
    connection.current = null; setDeadlines(null); setLive(false); setDeadlineError("");
    try { localStorage.removeItem(DEADLINE_STORAGE); sessionStorage.removeItem("moodle-calendar-pairing"); } catch { /* Current page still clears. */ }
  };
  const downloadDeadlines = () => {
    const url = URL.createObjectURL(new Blob([deadlinesICS(deadlines?.events ?? [])], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "moodle-paradoseis-2026-27.ics";
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cellCount = Math.ceil((offset + daysInMonth) / 7) * 7;
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    return Array.from({ length: cellCount }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [month]);

  const selectedEvents = eventsForDay(selectedDate, allEvents);
  const selectedPhase = phaseForDay(selectedDate);
  const previousDisabled = month.getFullYear() === 2026 && month.getMonth() === 8;
  const nextDisabled = month.getFullYear() === 2027 && month.getMonth() === 5;

  const moveMonth = (direction: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + direction, 1);
    const prefix = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-`;
    const firstEvent = allEvents.find(
      (event) => event.category !== "Ακαδημαϊκή περίοδος" && event.date.startsWith(prefix),
    );
    setMonth(next);
    setSelectedDate(firstEvent?.date ?? dateKey(next));
  };

  return (
    <main className="site-shell">
      <header className="site-header">
        <div>
          <h1>AI for Digital Transformation</h1>
          <p>Ακαδημαϊκό ημερολόγιο 2026–27</p>
          <p>Ενημέρωση προγράμματος: {new Intl.DateTimeFormat("el-GR", { timeZone: "Europe/Athens", dateStyle: "short" }).format(new Date(timetableRevision.updatedAt))}</p>
        </div>
        <a className="download-link" href={`${basePath}/pmsc-ai-digital-transformation-2026-27.ics`} download>
          Λήψη .ics
        </a>
      </header>

      <section className="moodle-panel" aria-label="Ιδιωτικές παραδόσεις Moodle">
        <div>
          <strong><i className="dot deadline" /> Παραδόσεις εργασιών {deadlines ? `· ${deadlines.events.length}` : ""}</strong>
          <p>{deadlines ? `${live ? "Συνδεδεμένο με το Moodle Monitor" : "Αποθηκευμένες προθεσμίες"} · μόνο σε αυτόν τον browser.`
            : "Άνοιξε το ημερολόγιο από το Moodle Monitor για να δεις τις προσωπικές σου προθεσμίες."}</p>
          {deadlines?.checkedAt && <p>Τελευταία ανάγνωση Moodle: {new Intl.DateTimeFormat("el-GR", { timeZone: "Europe/Athens", dateStyle: "short", timeStyle: "short" }).format(new Date(deadlines.checkedAt))} · Ώρες Ελλάδας</p>}
          {!!deadlines?.withoutDue && <p>{deadlines.withoutDue} εργασίες χωρίς ορισμένη ημερομηνία.</p>}
          {!!deadlines?.outsidePeriod && <p>{deadlines.outsidePeriod} προθεσμίες εκτός Σεπτεμβρίου 2026–Ιουνίου 2027 δεν εμφανίζονται.</p>}
          {deadlines?.incomplete && <p className="deadline-error">Η αρχική ανάγνωση εργασιών δεν έχει ολοκληρωθεί για όλα τα επιλεγμένα μαθήματα.</p>}
          {deadlineError && <p className="deadline-error" role="status">{deadlineError}</p>}
        </div>
        <div className="moodle-actions">
          {deadlines && <button type="button" onClick={downloadDeadlines}>Λήψη εργασιών .ics</button>}
          <a href="http://127.0.0.1:8765/" target="_blank" rel="noopener noreferrer">Moodle Monitor ↗</a>
          {deadlines && <button className="clear-deadlines" type="button" onClick={clearDeadlines}>Αφαίρεση από αυτόν τον browser</button>}
        </div>
      </section>

      <section className="calendar" aria-label="Ακαδημαϊκό ημερολόγιο">
        <div className="calendar-toolbar">
          <div className="month-navigation">
            <button type="button" onClick={() => moveMonth(-1)} disabled={previousDisabled} aria-label="Προηγούμενος μήνας">←</button>
            <h2>{monthNames[month.getMonth()]} {month.getFullYear()}</h2>
            <button type="button" onClick={() => moveMonth(1)} disabled={nextDisabled} aria-label="Επόμενος μήνας">→</button>
          </div>
        </div>

        <div className="calendar-layout">
          <div className="month-grid" role="grid" aria-label={`${monthNames[month.getMonth()]} ${month.getFullYear()}`}>
            {weekdays.map((weekday) => <div className="weekday" role="columnheader" key={weekday}>{weekday}</div>)}
            {days.map((day) => {
              const key = dateKey(day);
              const isOutside = day.getMonth() !== month.getMonth();
              if (isOutside) {
                return <div className="day-cell outside" role="gridcell" aria-hidden="true" key={key} />;
              }

              const dayEvents = eventsForDay(key, allEvents);
              const previewEvents = [...dayEvents].sort((a, b) => Number(b.category === DEADLINE_CATEGORY) - Number(a.category === DEADLINE_CATEGORY));
              const isSelected = key === selectedDate;
              return (
                <button
                  type="button"
                  role="gridcell"
                  key={key}
                  className={`day-cell${isOutside ? " outside" : ""}${isSelected ? " selected" : ""}`}
                  aria-selected={isSelected}
                  aria-label={`${longDate.format(day)}, ${dayEvents.length} συμβάντα`}
                  onClick={() => setSelectedDate(key)}
                >
                  <span className="day-number">{day.getDate()}</span>
                  <span className="cell-events">
                    {previewEvents.slice(0, 3).map((event) => (
                      <span className="event-chip" data-category={event.category} key={event.id}>
                        {!event.allDay && <span className="chip-time">{event.startTime}</span>}
                        {cleanTitle(event.title)}
                      </span>
                    ))}
                    {dayEvents.length > 3 && <span className="more-events">+{dayEvents.length - 3} ακόμη</span>}
                  </span>
                </button>
              );
            })}
          </div>

          <aside className="day-panel" aria-live="polite">
            <div className="day-panel-heading">
              <h3>{longDate.format(localDate(selectedDate))}</h3>
              {selectedPhase && <p className="phase-label">{selectedPhase.title}</p>}
            </div>
            <div className="day-event-list">
              {selectedEvents.length === 0 ? (
                <p className="empty-state">Δεν υπάρχουν προγραμματισμένα συμβάντα.</p>
              ) : selectedEvents.map((event) => (
                <article className="day-event" data-category={event.category} key={event.id}>
                  <div className="event-meta">
                    <span>{kindLabel(event.category)}</span>
                    <time>{event.category === DEADLINE_CATEGORY ? `Έως ${event.startTime}` : event.allDay ? "Όλη μέρα" : `${event.startTime}–${event.endTime}`}</time>
                  </div>
                  <h4>{cleanTitle(event.title)}</h4>
                  {event.location && <p>{event.location}</p>}
                  {event.course && <p>{event.course}</p>}
                  {event.url && <a className="assignment-link" href={event.url} target="_blank" rel="noopener noreferrer">Άνοιγμα εργασίας στο Moodle ↗</a>}
                </article>
              ))}
            </div>
          </aside>
        </div>

        <footer className="calendar-footer">
          <div className="legend" aria-label="Υπόμνημα">
            <span><i className="dot course" />Μάθημα</span>
            <span><i className="dot exam" />Εξέταση</span>
            <span><i className="dot replacement" />Αναπλήρωση</span>
            <span><i className="dot holiday" />Αργία</span>
            <span><i className="dot deadline" />Παράδοση εργασίας</span>
          </div>
        </footer>
      </section>
    </main>
  );
}
