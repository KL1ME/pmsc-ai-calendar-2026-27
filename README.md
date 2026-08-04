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
