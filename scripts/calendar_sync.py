"""Parse supported AUEB timetable tables and update web/ICS from one snapshot.

Unknown layouts and course names raise an error; they never invent calendar data.
Only the academic period/category explicitly covered by a table is replaced.
"""
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
MARKER = 'export const calendarEvents: CalendarEvent[] = '
ICS_PATH = 'public/pmsc-ai-digital-transformation-2026-27.ics'


def read_events(root=ROOT):
    text = (root / 'app/calendar-data.ts').read_text()
    return json.loads(text.split(MARKER, 1)[1].strip().removesuffix(';'))


def norm(text):
    return re.sub(r'[^a-z0-9]', '', text.lower().replace('&', 'and').replace('modelling', 'modeling'))


def course_title(title):
    return re.sub(r'^\[[^]]+\]\s*', '', title).replace(' (Presentations)', '').removesuffix(' - Lab')


def identify(cell, courses):
    cleaned = norm(cell)
    matches = [c for c in courses if norm(c) in cleaned]
    if len(matches) != 1:
        raise ValueError('Unknown or ambiguous course in timetable cell')
    return matches[0]


def location(cell):
    cell = re.sub(r'\s+', ' ', cell)
    rooms = re.findall(r'Evelpidon\s+47[ΑA],?\s*(\d{3})', cell, re.I)
    rooms = list(dict.fromkeys(rooms))
    if len(rooms) == 2 and 'Barlas' in cell and 'Maroulis' in cell:
        return 'Ευελπίδων 47Α: Αίθουσα 404 (Barlas - Markou), Αίθουσα 901 (Maroulis - Ziogas)'
    if not rooms:
        raise ValueError('No explicit room in timetable cell')
    result = 'Ευελπίδων 47Α, Αίθουσα ' + ', '.join(rooms)
    floor = re.search(r'\b' + rooms[0] + r',\s*(\d+)(?:st|nd|rd|th)\s+floor', cell, re.I)
    if len(rooms) == 1 and floor:
        result += ', ' + floor[1] + 'ος όροφος'
    return result


def period(text, year):
    match = re.search(r'(\d{1,2})/(\d{1,2})\s*-\s*(\d{1,2})/(\d{1,2})', text)
    if not match:
        raise ValueError('Missing timetable period')
    d1, m1, d2, m2 = map(int, match.groups())
    first_year = year + (m1 < 9)
    return date(first_year, m1, d1), date(first_year + (m2 < m1), m2, d2)


def make_event(title, day, times, room, category):
    return {'title': f'[{category}] {title}', 'date': day.isoformat(), 'endDate': day.isoformat(),
            'startTime': times[0], 'endTime': times[1], 'allDay': False,
            'location': room, 'category': category}


def parse_pdf(path, existing, year=2026):
    import pdfplumber
    courses = sorted({course_title(e['title']) for e in existing if not e['allDay'] and e['category'] != 'Προπαρασκευαστικό'})
    holidays = [(e['date'], e['endDate']) for e in existing if e['category'] == 'Αργία']
    scopes = []
    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables():
                if not table or not table[0] or not table[0][0]:
                    continue
                weekly = 'WEEK PROGRAM' in table[0][0]
                if weekly:
                    scope = None
                    for row in table[1:]:
                        if len(row) != 9:
                            raise ValueError('Unsupported weekly layout')
                        if row[1] and 'Monday' in (row[3] or ''):
                            # PDF uses rotated cells: their extracted characters are reversed.
                            span = re.sub(r'\s+', '', row[1])[::-1]
                            start, end = period(span, year)
                            scope = {'category': 'Μάθημα', 'start': start.isoformat(), 'end': end.isoformat(), 'events': []}
                            scopes.append(scope)
                        timing = re.fullmatch(r'(\d{1,2})[.:](\d{2})-(\d{1,2})[.:](\d{2})', row[2] or '')
                        if not timing:
                            continue
                        if scope is None:
                            raise ValueError('Time row without weekly period')
                        h1, m1, h2, m2 = map(int, timing.groups())
                        times = (f'{h1:02}:{m1:02}', f'{h2:02}:{m2:02}')
                        for weekday, cell in enumerate(row[3:]):
                            if not cell:
                                continue
                            title, room = identify(cell, courses), location(cell)
                            current = date.fromisoformat(scope['start'])
                            while current <= date.fromisoformat(scope['end']):
                                if current.weekday() == weekday and not any(a <= current.isoformat() < b for a, b in holidays):
                                    scope['events'].append(make_event(title, current, times, room, scope['category']))
                                current += timedelta(days=1)
                elif 'REPLACEMENT PERIOD' in table[0][0] or 'EXAMS PROGRAM' in table[0][0]:
                    scope, dates = None, None
                    for row in table:
                        heading = row[0] or ''
                        if 'REPLACEMENT PERIOD' in heading or 'EXAMS PROGRAM' in heading:
                            start, end = period(heading, year)
                            scope = {'category': 'Αναπλήρωση' if 'REPLACEMENT' in heading else 'Εξέταση',
                                     'start': start.isoformat(), 'end': end.isoformat(), 'events': []}
                            scopes.append(scope)
                            dates = None
                        if len(row) == 7 and 'Monday' in (row[1] or ''):
                            dates = []
                            for heading in row[1:]:
                                match = re.search(r'(\d{1,2})/(\d{1,2})', heading or '')
                                if not match:
                                    raise ValueError('Missing column date')
                                d, m = map(int, match.groups())
                                dates.append(date(year + (m < 9), m, d))
                        timing = re.fullmatch(r'(\d{1,2})[.:](\d{2})-(\d{1,2})[.:](\d{2})', row[0] or '')
                        if not timing:
                            continue
                        if scope is None or dates is None or len(row) != 7:
                            raise ValueError('Unsupported replacement/examination layout')
                        h1, m1, h2, m2 = map(int, timing.groups())
                        for day, cell in zip(dates, row[1:]):
                            if not cell or cell.strip() == 'Holiday':
                                continue
                            title = identify(cell, courses)
                            if 'Presentations' in cell:
                                title += ' (Presentations)'
                            scope['events'].append(make_event(title, day, (f'{h1:02}:{m1:02}', f'{h2:02}:{m2:02}'), location(cell), scope['category']))
    if not scopes or any(not s['events'] for s in scopes):
        raise ValueError('No complete supported timetable found')
    return scopes


def merge(events, scopes):
    events = [dict(e) for e in events]
    changes, removed = [], []
    for scope in scopes:
        old = [e for e in events if e['category'] == scope['category'] and scope['start'] <= e['date'] <= scope['end']
               and (not scope.get('course') or course_title(e['title']) == scope['course'])]
        remaining = [e for e in events if e not in old]
        by_course = defaultdict(list)
        for e in sorted(old, key=lambda e: (e['date'], e['startTime'])):
            by_course[course_title(e['title'])].append(e)
        for row in sorted(scope['events'], key=lambda e: (e['date'], e['startTime'])):
            row = dict(row)
            key = course_title(row['title'])
            prior = by_course[key].pop(0) if by_course[key] else None
            row['id'] = prior['id'] if prior else hashlib.sha1(json.dumps(row, sort_keys=True).encode()).hexdigest()
            if prior:
                # Preserve optional public metadata for an existing occurrence.
                row = {**prior, **row}
            if row != prior:
                changes.append({'before': prior, 'after': row})
            remaining.append(row)
        leftovers = [e for group in by_course.values() for e in group]
        removed.extend(leftovers)
        changes.extend({'before': e, 'after': None} for e in leftovers)
        events = remaining
    events.sort(key=lambda e: (e['date'], e['startTime'], e['id']))
    validate(events)
    return events, changes, removed


def parse_dated_body(text, existing):
    """Accept only explicit English full-date/time/course/room announcement lines."""
    months = {name.lower(): number for number, name in enumerate(
        ('January February March April May June July August September October November December').split(), 1)}
    courses = {course_title(e['title']) for e in existing if not e['allDay']}
    pattern = re.compile(r'(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+'
        r'(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2}),?\s+'
        r'(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})\s*:\s*'
        r'([^\n]+?)\s*[-–—]\s*Room\s+(\d{3})', re.I)
    scopes = []
    grouped = {}
    for match in pattern.finditer(text):
        d, month, year, h1, m1, h2, m2, cell, room = match.groups()
        if month.lower() not in months:
            raise ValueError('Unknown month in dated announcement')
        day = date(int(year), months[month.lower()], int(d))
        title = identify(cell, courses)
        monday = day - timedelta(days=day.weekday())
        sunday = monday + timedelta(days=6)
        candidates = [e for e in existing if monday.isoformat() <= e['date'] <= sunday.isoformat()
                      and course_title(e['title']) == title and e['category'] in ('Μάθημα', 'Αναπλήρωση')]
        categories = {e['category'] for e in candidates}
        if len(categories) != 1 or len(candidates) != 1:
            raise ValueError('Dated announcement does not uniquely identify an occurrence')
        category = categories.pop()
        key = title, monday.isoformat(), category
        scope = grouped.setdefault(key, {'category': category, 'course': title, 'start': monday.isoformat(),
                                        'end': sunday.isoformat(), 'events': []})
        scope['events'].append(make_event(title, day, (f'{int(h1):02}:{m1}', f'{int(h2):02}:{m2}'),
                                         'Ευελπίδων 47Α, Αίθουσα ' + room, category))
    return list(grouped.values())


def validate(events):
    if len({e['id'] for e in events}) != len(events):
        raise ValueError('Duplicate calendar IDs')
    seen = set()
    for e in events:
        start, end = date.fromisoformat(e['date']), date.fromisoformat(e['endDate'])
        if not date(2026, 9, 1) <= start <= end <= date(2027, 7, 1):
            raise ValueError('Event outside academic year')
        if not e['allDay']:
            for field in ('startTime', 'endTime'):
                datetime.strptime(e[field], '%H:%M')
            if e['startTime'] >= e['endTime']:
                raise ValueError('Invalid event duration')
        key = (e['title'], e['date'], e['startTime'], e['category'])
        if key in seen:
            raise ValueError('Duplicate calendar occurrence')
        seen.add(key)


def unfold(text):
    return re.sub(r'\n[ \t]', '', text.replace('\r\n', '\n'))


def escape(text):
    return text.replace('\\', '\\\\').replace('\n', '\\n').replace(',', '\\,').replace(';', '\\;')


def fold(line):
    chunks, current = [], ''
    for char in line:
        if len((current + char).encode()) > 73:
            chunks.append(current)
            current = ' '
        current += char
    return '\r\n'.join(chunks + [current])


def write(events, removed, root=ROOT):
    source = root / 'app/calendar-data.ts'
    source.write_text(source.read_text().split(MARKER, 1)[0] + MARKER + json.dumps(events, ensure_ascii=False, indent=2) + ';\n')
    old = unfold((root / ICS_PATH).read_text())
    head = old.split('BEGIN:VEVENT', 1)[0].strip().removesuffix('END:VCALENDAR').strip()
    previous = {}
    for block in re.findall(r'BEGIN:VEVENT\n(.*?)\nEND:VEVENT', old, re.S):
        uid = re.search(r'^UID:([^\n]+)', block, re.M)
        if uid:
            previous[uid[1].split('@')[0]] = block
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    lines = head.splitlines()
    active_ids = {e['id'] for e in events}
    for e in events:
        block = previous.get(e['id'], '')
        seq = re.search(r'^SEQUENCE:(\d+)', block, re.M)
        fields = ['BEGIN:VEVENT', 'UID:' + e['id'] + '@pmsc-aidt', 'DTSTAMP:' + stamp,
                  'LAST-MODIFIED:' + stamp, 'SEQUENCE:' + str(int(seq[1]) + 1 if seq else 1)]
        for field, key in [('DTSTART', 'date'), ('DTEND', 'endDate')]:
            value = e[key].replace('-', '')
            if e['allDay']:
                fields.append(field + ';VALUE=DATE:' + value)
            else:
                t = e['startTime' if field == 'DTSTART' else 'endTime'].replace(':', '')
                fields.append(field + ';TZID=Europe/Athens:' + value + 'T' + t + '00')
        fields.extend(['SUMMARY:' + escape(e['title']), 'LOCATION:' + escape(e['location']),
                       'CATEGORIES:' + escape(e['category']), 'STATUS:CONFIRMED'])
        # Keep source descriptions/instructors without copying email bodies.
        description = re.search(r'^DESCRIPTION:(.*)', block, re.M)
        if description:
            fields.append('DESCRIPTION:' + description[1])
        fields.append('END:VEVENT')
        lines.extend(fields)
    # Carry cancellations forward so calendar subscribers can remove old events.
    cancelled = {e['id'] for e in removed}
    cancelled.update(k for k, v in previous.items() if 'STATUS:CANCELLED' in v)
    for uid in sorted(cancelled - active_ids):
        block = previous.get(uid)
        if not block:
            continue
        block = re.sub(r'^STATUS:[^\n]*', 'STATUS:CANCELLED', block, flags=re.M)
        block = re.sub(r'^DTSTAMP:[^\n]*', 'DTSTAMP:' + stamp, block, flags=re.M)
        seq = re.search(r'^SEQUENCE:(\d+)', block, re.M)
        block = re.sub(r'^SEQUENCE:\d+', 'SEQUENCE:' + str(int(seq[1]) + 1), block, flags=re.M) if seq else block + '\nSEQUENCE:1'
        lines.extend(['BEGIN:VEVENT', *block.splitlines(), 'END:VEVENT'])
    lines.append('END:VCALENDAR')
    (root / ICS_PATH).write_bytes(('\r\n'.join(fold(line) for line in lines) + '\r\n').encode())
