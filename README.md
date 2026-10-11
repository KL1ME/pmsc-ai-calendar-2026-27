# PMSc AI Academic Calendar 2026–27

Minimal, responsive academic calendar for the PMSc in AI for Digital
Transformation.

## Live site

[Open the calendar on GitHub Pages](https://kl1me.github.io/pmsc-ai-calendar-2026-27/)

[Private Sites deployment](https://pmsc-ai-calendar-2026-27.apfivos.chatgpt.site)

## Features

- Monthly view from September 2026 through June 2027
- Classes, examinations, replacement sessions, laboratories and holidays
- Detailed daily schedule with time and location
- Downloadable iCalendar file for Apple Calendar, Google Calendar and Outlook
- Responsive desktop and mobile layout

The calendar contains 188 events. All 166 timed events were checked against the
source programme and examination tables.

## Local development

Requires Node.js 22.13 or newer and pnpm.

```bash
pnpm install
pnpm run dev
```

Create a production build with:

```bash
pnpm run build
```

## Calendar data

The web calendar data is stored in `app/calendar-data.ts`. The downloadable
`.ics` file is stored in `public/pmsc-ai-digital-transformation-2026-27.ics`.

## Private Moodle deadlines

Open this calendar using **Ημερολόγιο & παραδόσεις** in the local Moodle Monitor.
Assignment deadlines appear in orange, with the Moodle due time in Europe/Athens,
course name and assignment link. The existing 188 timetable records stay unchanged.

The monitor and calendar exchange a minimal snapshot through `postMessage`,
checking the exact origin, source window and random pairing session. The Moodle
token never leaves the local monitor. No personal deadline data is committed,
uploaded to GitHub, or included in the static build. The snapshot is stored only
in this browser profile's local storage; people using the same profile can see it.

Keep the Monitor tab open to refresh the calendar after its normal Moodle checks.
Without the Monitor tab, the last saved snapshot remains visible with its read
time. Reopen from the Monitor button to reconnect. Other browsers and devices do
not automatically receive the snapshot. The remove button clears the local copy
and disconnects that tab. Disconnecting the Moodle account alone does not erase
the separate browser copy.

Assignments without a due date or outside September 2026–June 2027 are counted
separately. Missing assignments are removed after a successful source read;
failed reads preserve the previous snapshot and its timestamp. A displayed
deadline does not mean an assignment is unsubmitted. The private `.ics` download
is a snapshot and is separate from the public timetable `.ics` file.

Run `pnpm run test:dates` and `pnpm run test:deadlines` before publishing. GitHub
Pages builds with `pnpm run build:pages` and the base-path variables in its workflow.
