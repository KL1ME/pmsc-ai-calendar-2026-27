from __future__ import annotations

import json
import shutil
from pathlib import Path


site = Path(__file__).parents[1]
ics = site.parents[1] / "outputs" / "pmsc_ai_digital_transformation_2026-27.ics"

physical = ics.read_text(encoding="utf-8").splitlines()
logical: list[str] = []
for line in physical:
    if line.startswith(" "):
        logical[-1] += line[1:]
    else:
        logical.append(line)


def unescape(value: str) -> str:
    return value.replace("\\n", "\n").replace("\\,", ",").replace("\\;", ";").replace("\\\\", "\\")


raw_events: list[dict[str, str]] = []
current: dict[str, str] | None = None
for line in logical:
    if line == "BEGIN:VEVENT":
        current = {}
    elif line == "END:VEVENT":
        assert current is not None
        raw_events.append(current)
        current = None
    elif current is not None:
        key, value = line.split(":", 1)
        current[key] = unescape(value)


def date_value(value: str) -> str:
    return f"{value[0:4]}-{value[4:6]}-{value[6:8]}"


events = []
for raw in raw_events:
    start_key = next(key for key in raw if key.startswith("DTSTART"))
    end_key = next(key for key in raw if key.startswith("DTEND"))
    all_day = "VALUE=DATE" in start_key
    start_raw = raw[start_key]
    end_raw = raw[end_key]
    events.append(
        {
            "id": raw["UID"].split("@", 1)[0],
            "title": raw["SUMMARY"],
            "date": date_value(start_raw),
            "endDate": date_value(end_raw),
            "startTime": "" if all_day else f"{start_raw[9:11]}:{start_raw[11:13]}",
            "endTime": "" if all_day else f"{end_raw[9:11]}:{end_raw[11:13]}",
            "allDay": all_day,
            "location": raw.get("LOCATION", ""),
            "category": raw.get("CATEGORIES", ""),
        }
    )

payload = json.dumps(events, ensure_ascii=False, indent=2)
(site / "app" / "calendar-data.ts").write_text(
    "export type CalendarEvent = {\n"
    "  id: string;\n  title: string;\n  date: string;\n  endDate: string;\n"
    "  startTime: string;\n  endTime: string;\n  allDay: boolean;\n"
    "  location: string;\n  category: string;\n};\n\n"
    f"export const calendarEvents: CalendarEvent[] = {payload};\n",
    encoding="utf-8",
)
shutil.copy2(ics, site / "public" / "pmsc-ai-digital-transformation-2026-27.ics")
print(f"Generated {len(events)} events")
