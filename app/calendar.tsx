"use client";

import { useMemo, useState } from "react";
import { calendarEvents } from "./calendar-data";

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

function eventsForDay(key: string) {
  return calendarEvents.filter((event) => {
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

  const selectedEvents = eventsForDay(selectedDate);
  const selectedPhase = phaseForDay(selectedDate);
  const previousDisabled = month.getFullYear() === 2026 && month.getMonth() === 8;
  const nextDisabled = month.getFullYear() === 2027 && month.getMonth() === 5;

  const moveMonth = (direction: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + direction, 1);
    const prefix = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-`;
    const firstEvent = calendarEvents.find(
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
        </div>
        <a className="download-link" href="/pmsc-ai-digital-transformation-2026-27.ics" download>
          Λήψη .ics
        </a>
      </header>

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
              const dayEvents = eventsForDay(key);
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
        </footer>
      </section>
    </main>
  );
}
