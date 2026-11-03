import unittest
from pathlib import Path
from unittest.mock import patch
import tempfile
import pymupdf
from parse_acceptance_scan import parse_scan

def box(x,y,text,confidence=1):return [[[x,y],[x+50,y],[x+50,y+10],[x,y+10]],text,confidence]
class ScanReaderTests(unittest.TestCase):
 def test_uses_list_position_not_world_rank_and_keeps_partial_status(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'scan.pdf';doc=pymupdf.open();doc.new_page();doc.save(p)
   rows=[box(100,20,'WS Acceptance list'),box(200,40,'Member ID'),box(300,40,'Player'),box(600,40,'Nationality'),box(80,60,'Qualifying'),box(100,80,'2'),box(220,80,'87112'),box(330,80,'[BUL] Kaloyana NALBANTOVA'),box(700,80,'36')]
   with patch('parse_acceptance_scan.RapidOCR') as engine:
    engine.return_value.return_value=(rows,None)
    result=parse_scan(str(p))
   self.assertFalse(result['complete']);self.assertEqual(result['entries'][0]['status'],'Q2');self.assertEqual(result['entries'][0]['memberIds'],['87112'])
 def test_low_confidence_position_is_rejected(self):
  with tempfile.TemporaryDirectory() as d:
   p=Path(d)/'scan.pdf';doc=pymupdf.open();doc.new_page();doc.save(p)
   rows=[box(100,20,'WS Acceptance list'),box(200,40,'Member ID'),box(300,40,'Player'),box(600,40,'Nationality'),box(80,60,'Main'),box(100,80,'1',.7),box(220,80,'87112'),box(330,80,'[BUL] Kaloyana NALBANTOVA')]
   with patch('parse_acceptance_scan.RapidOCR') as engine:
    engine.return_value.return_value=(rows,None)
    with self.assertRaises(ValueError):parse_scan(str(p))
if __name__=='__main__':unittest.main()
