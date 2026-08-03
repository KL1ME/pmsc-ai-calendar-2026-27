"use client";

import { useMemo, useState } from "react";
import { calendarEvents, type CalendarEvent } from "./calendar-data";

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

const filters = ["Όλα", "Μαθήματα", "Εξετάσεις", "Αναπληρώσεις", "Αργίες"] as const;
type Filter = (typeof filters)[number];

const pad = (value: number) => String(value).padStart(2, "0");
const dateKey = (value: Date) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
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

function matchesFilter(event: CalendarEvent, filter: Filter) {
  if (filter === "Όλα") return event.category !== "Ακαδημαϊκή περίοδος";
  if (filter === "Μαθήματα") return ["Μάθημα", "Προπαρασκευαστικό", "Εργαστήριο"].includes(event.category);
  if (filter === "Εξετάσεις") return event.category === "Εξέταση";
  if (filter === "Αναπληρώσεις") return event.category === "Αναπλήρωση";
  return event.category === "Αργία";
}

function eventsForDay(key: string, filter: Filter) {
  return calendarEvents.filter((event) => {
    if (!matchesFilter(event, filter)) return false;
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
  const [selectedDate, setSelectedDate] = useState("2026-09-21");
  const [filter, setFilter] = useState<Filter>("Όλα");

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [month]);

  const selectedEvents = eventsForDay(selectedDate, filter);
  const selectedPhase = phaseForDay(selectedDate);
  const previousDisabled = month.getFullYear() === 2026 && month.getMonth() === 8;
  const nextDisabled = month.getFullYear() === 2027 && month.getMonth() === 5;

  const moveMonth = (direction: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + direction, 1);
    setMonth(next);
    setSelectedDate(dateKey(next));
  };

  return (
    <main className="site-shell">
      <header className="masthead">
        <div className="brand-mark" aria-hidden="true">AI</div>
        <div className="brand-copy">
          <span className="university">Οικονομικό Πανεπιστήμιο Αθηνών · School of Business</span>
          <h1>AI for Digital Transformation</h1>
          <p>Ακαδημαϊκό ημερολόγιο 2026–27</p>
        </div>
        <a className="download-button" href="/pmsc-ai-digital-transformation-2026-27.ics" download>
          <span aria-hidden="true">↓</span> Λήψη ημερολογίου
        </a>
      </header>

      <section className="calendar-card" aria-label="Ακαδημαϊκό ημερολόγιο">
        <div className="calendar-toolbar">
          <div className="month-navigation">
            <button type="button" onClick={() => moveMonth(-1)} disabled={previousDisabled} aria-label="Προηγούμενος μήνας">←</button>
            <h2>{monthNames[month.getMonth()]} {month.getFullYear()}</h2>
            <button type="button" onClick={() => moveMonth(1)} disabled={nextDisabled} aria-label="Επόμενος μήνας">→</button>
          </div>
          <div className="filters" aria-label="Φίλτρα συμβάντων">
            {filters.map((item) => (
              <button
                type="button"
                key={item}
                className={filter === item ? "active" : ""}
                aria-pressed={filter === item}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="calendar-layout">
          <div className="month-grid" role="grid" aria-label={`${monthNames[month.getMonth()]} ${month.getFullYear()}`}>
            {weekdays.map((weekday) => <div className="weekday" role="columnheader" key={weekday}>{weekday}</div>)}
            {days.map((day) => {
              const key = dateKey(day);
              const dayEvents = eventsForDay(key, filter);
              const isOutside = day.getMonth() !== month.getMonth();
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
                    {dayEvents.slice(0, 3).map((event) => (
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
              <span className="eyebrow">Επιλεγμένη ημέρα</span>
              <h3>{longDate.format(localDate(selectedDate))}</h3>
              {selectedPhase && <p className="phase-label">{selectedPhase.title}</p>}
            </div>
            <div className="day-event-list">
              {selectedEvents.length === 0 ? (
                <p className="empty-state">Δεν υπάρχουν προγραμματισμένα συμβάντα με αυτό το φίλτρο.</p>
              ) : selectedEvents.map((event) => (
                <article className="day-event" data-category={event.category} key={event.id}>
                  <div className="event-meta">
                    <span>{kindLabel(event.category)}</span>
                    <time>{event.allDay ? "Όλη μέρα" : `${event.startTime}–${event.endTime}`}</time>
                  </div>
                  <h4>{cleanTitle(event.title)}</h4>
                  {event.location && <p>{event.location}</p>}
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
          </div>
          <p>188 συμβάντα · Ώρα Ελλάδας (Europe/Athens)</p>
        </footer>
      </section>
    </main>
  );
}
