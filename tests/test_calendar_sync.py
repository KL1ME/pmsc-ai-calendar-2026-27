import copy
from datetime import date
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from calendar_sync import merge, validate, period, location, fold, write, read_events, ROOT, ICS_PATH, unfold


def event(day='2026-10-14', title='[Μάθημα] Data Management and Engineering'):
    return dict(id='a' * 40, title=title, date=day, endDate=day, startTime='15:00',
                endTime='18:00', allDay=False, location='Room 901', category='Μάθημα')


class SyncTests(unittest.TestCase):
    def test_move_preserves_id_and_unrelated_events(self):
        old = event()
        other = event('2027-02-01'); other['id'] = 'b' * 40
        updated = dict(old, date='2026-10-17', endDate='2026-10-17', location='Room 403')
        del updated['id']
        scope = dict(category='Μάθημα', start='2026-10-12', end='2026-10-31', events=[updated])
        new, changed, removed = merge([old, other], [scope])
        self.assertEqual(new[0]['id'], old['id'])
        self.assertEqual(new[1], other)
        self.assertEqual(len(changed), 1)
        self.assertEqual(removed, [])
        self.assertEqual(merge(new, [scope])[1], [])

    def test_authoritative_scope_removes_cancelled_exam_only_in_period(self):
        old = event(title='[Εξέταση] Digital Transformation and Business Strategy')
        old['category'] = 'Εξέταση'
        later = dict(old, id='b' * 40, date='2027-02-01', endDate='2027-02-01')
        new, _, removed = merge([old, later], [dict(category='Εξέταση', start='2026-10-01', end='2026-10-31', events=[])])
        self.assertEqual(new, [later])
        self.assertEqual(removed, [old])

    def test_athens_academic_period_crosses_year(self):
        self.assertEqual(period('2nd period (23/11-16/1)', 2026), (date(2026, 11, 23), date(2027, 1, 16)))
        self.assertEqual(period('EXAMS (18/1-30/1)', 2026), (date(2027, 1, 18), date(2027, 1, 30)))

    def test_rooms_and_surname_groups(self):
        self.assertIn('4ος όροφος', location('Evelpidon 47A, 404, 4th floor'))
        self.assertIn('Barlas - Markou', location('Evelpidon 47A, 404, 4th floor (Barlas - Markou) & Evelpidon 47A, 901, 9th floor (Maroulis - Ziogas)'))
        with self.assertRaises(ValueError): location('Room to be announced')

    def test_invalid_dates_and_duplicate_occurrences_rejected(self):
        old = event()
        with self.assertRaises(ValueError): validate([old, dict(old, id='b' * 40)])
        with self.assertRaises(ValueError): validate([dict(old, date='2026-02-30')])

    def test_ics_utf8_lines_are_folded_without_splitting_characters(self):
        self.assertTrue(all(len(x.encode()) <= 75 for x in fold('SUMMARY:' + 'Αθήνα ' * 40).split('\r\n')))

    def test_web_and_ics_share_active_ids_and_cancelled_events_persist(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); (root/'app').mkdir(); (root/'public').mkdir()
            (root/'app/calendar-data.ts').write_text((ROOT/'app/calendar-data.ts').read_text())
            (root/ICS_PATH).write_bytes((ROOT/ICS_PATH).read_bytes())
            old = read_events(root)
            removed = old.pop(1)
            write(old, [removed], root)
            self.assertEqual(read_events(root), old)
            ics = unfold((root/ICS_PATH).read_text())
            block = ics.split('UID:' + removed['id'] + '@', 1)[1].split('END:VEVENT')[0]
            self.assertIn('STATUS:CANCELLED', block)
            write(old, [], root)
            self.assertIn('STATUS:CANCELLED', unfold((root/ICS_PATH).read_text()))


if __name__ == '__main__': unittest.main()
