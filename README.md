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

The current calendar contains 187 events (165 timed). The October 23 update
incorporates the official revised semester timetable effective October 12 and
the replacement/examination timetable sent October 22. Both the web calendar
and public ICS are generated from the same validated snapshot.

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
course name and assignment link. Timetable updates are separate from private deadlines.

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

## Current GitHub Pages publishing

Pages serves prebuilt static files from the root of `gh-pages`, including
`.nojekyll`. The October 2026 update was built and tested locally because GitHub
Actions reported an account billing/spending restriction before starting a runner.
No billing settings were changed. This is GitHub's supported direct publishing
mode: https://github.blog/changelog/2024-07-08-pages-legacy-worker-sunset/

For updates, build with `PAGES_BASE_PATH=/pmsc-ai-calendar-2026-27`,
`NEXT_PUBLIC_BASE_PATH=/pmsc-ai-calendar-2026-27` and
`NEXT_PUBLIC_SITE_URL=https://kl1me.github.io`, then publish only the contents of
`out/` plus `.nojekyll` to `gh-pages`. Keep source code on `main` and personal
Moodle data outside both branches. A push to `main` alone does not update the site.
The original Actions workflow is retained for manual use after the account issue
is resolved and the Pages publishing source is restored to GitHub Actions.
