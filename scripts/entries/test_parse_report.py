import unittest, tempfile
from pathlib import Path
import pymupdf
from parse_report import parse_report

class ParserTests(unittest.TestCase):
    def make(self,path):
        doc=pymupdf.open()
        for code,title in [('MS',"Men's Singles"),('WS',"Women's Singles"),('MD',"Men's Doubles"),('WD',"Women's Doubles"),('XD','Mixed Doubles')]:
            page=doc.new_page(width=800,height=600)
            page.insert_text((200,50),title)
            headers=[(20,'Member ID'),(100,'LastName'),(190,'FirstName'),(280,'Country')]
            if code not in ('MS','WS'):headers += [(360,'LastName 2'),(450,'FirstName 2'),(540,'Gender 2')]
            headers += [(620,'Type'),(710,'Position')]
            for x,text in headers:page.insert_text((x,100),text,fontsize=8)
            for i,(kind,pos) in enumerate([('Main',1),('Qualifying',2),('Removed',0)]):
                y=120+i*20
                for x,text in [(20,'12345'),(100,'NALBANTOVA'),(190,'Kaloyana'),(280,'BUL'),(620,kind),(710,str(pos))]:page.insert_text((x,y),text,fontsize=8)
                if code not in ('MS','WS'):
                    page.insert_text((360,y),'PARTNER',fontsize=8);page.insert_text((450,y),'Second',fontsize=8)
        doc.save(path)
    def test_type_position_and_partner_integrity(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'report.pdf';self.make(p);rows=parse_report(str(p))
            self.assertEqual(len(rows),15)
            self.assertEqual([r['status'] for r in rows if r['discipline']=='WS'],['M1','Q2','Removed'])
            self.assertEqual(len(next(r for r in rows if r['discipline']=='MD')['names']),2)
    def test_refuses_unreadable_pdf(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'blank.pdf';doc=pymupdf.open();doc.new_page();doc.save(p)
            with self.assertRaises(ValueError):parse_report(str(p))
if __name__=='__main__':unittest.main()
