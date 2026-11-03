"""Conservative image acceptance-list reader. Low-confidence rows remain missing, never guessed."""
import hashlib,json,re,sys
from pathlib import Path
import numpy as np
import pymupdf
from rapidocr_onnxruntime import RapidOCR

def parse_scan(filename,cache=None):
    engine=RapidOCR(intra_op_num_threads=1,inter_op_num_threads=1)
    entries=[];discipline=None;section=None;columns=None;skipped=0;seen=set()
    for page_number,page in enumerate(pymupdf.open(filename),1):
        pix=page.get_pixmap(dpi=180,alpha=False)
        key=hashlib.sha256(pix.samples).hexdigest()
        file=Path(cache)/(key+'.json') if cache else None
        if file and file.exists():raw=json.loads(file.read_text())
        else:
            raw,_=engine(np.frombuffer(pix.samples,dtype=np.uint8).reshape(pix.height,pix.width,pix.n));raw=raw or []
            if file:file.parent.mkdir(parents=True,exist_ok=True);file.write_text(json.dumps(raw))
        boxes=[{'x':min(p[0] for p in b),'y':min(p[1] for p in b),'right':max(p[0] for p in b),'bottom':max(p[1] for p in b),'text':t.strip(),'confidence':float(c)} for b,t,c in raw]
        boxes.sort(key=lambda b:(b['y'],b['x']))
        for b in boxes:
            match=re.match(r'^(MS|WS|MD|WD|XD)\s*Acceptance\s*list',b['text'],re.I)
            if match:
                if discipline!=match[1].upper():section=None;columns=None
                discipline=match[1].upper()
        headers={}
        for b in boxes:
            text=re.sub(r'\s','',b['text']).lower()
            if text in ('memberid','player','nationality'):headers[text]=b
        if len(headers)==3:columns=(headers['memberid']['x'],headers['player']['x'],headers['nationality']['x'],headers['player']['bottom'])
        if not discipline or not columns:skipped+=1;continue
        member_x,player_x,nation_x,header_bottom=columns
        markers=[b for b in boxes if b['x']<member_x*.85 and re.sub(r'\s','',b['text']).lower() in ('main','qualifying','reserve','reserves','removed','withdrawn')]
        numbers=[b for b in boxes if b['x']<member_x*.85 and re.fullmatch(r'\d+',b['text']) and b['y']> (header_bottom if headers else 0)]
        for index,number in enumerate(numbers):
            y=number['y'];following=numbers[index+1]['y'] if index+1<len(numbers) else number['bottom']+60
            lo=y-5;hi=min(following-5,number['bottom']+(90 if discipline in ('MD','WD','XD') else 15))
            before=[m for m in markers if m['y']<y]
            if before:section=re.sub(r'\s','',before[-1]['text']).lower()
            member_ids=[b for b in boxes if member_x-2<=b['x']<player_x and lo<=b['y']<hi and re.fullmatch(r'\d{5,7}',b['text'])]
            people=[b for b in boxes if player_x-4<=b['x']<nation_x-8 and lo<=b['y']<hi and re.search(r'\[[A-Z]{3}\]',b['text'])]
            expected=1 if discipline in ('MS','WS') else 2
            if not member_ids and not people:continue # a page number, not an entry
            if len(people)!=expected or len(member_ids)!=expected or number['confidence']<.98 or any(b['confidence']<.90 for b in people) or any(b['confidence']<.98 for b in member_ids) or not section:
                skipped+=1;continue
            names=[re.sub(r'^.*?\[[A-Z]{3}\]\s*','',b['text']).strip() for b in people]
            if any(not re.search(r'[a-zA-Z]',name) for name in names):skipped+=1;continue
            prefix={'main':'M','qualifying':'Q','reserve':'R','reserves':'R','removed':'Removed','withdrawn':'Withdrawn'}[section]
            status=prefix+str(int(number['text'])) if len(prefix)==1 else prefix
            identity=(discipline,status,tuple(b['text'] for b in member_ids))
            if identity in seen:skipped+=1;continue
            seen.add(identity)
            entries.append({'discipline':discipline,'names':names,'memberIds':[b['text'] for b in member_ids],'status':status,'page':page_number,'extraction':'ocr'})
    if not entries:raise ValueError('No confident acceptance rows extracted')
    return {'entries':entries,'complete':False,'skippedRows':skipped,'extraction':'ocr'}
if __name__=='__main__':print(json.dumps(parse_scan(sys.argv[1],sys.argv[2] if len(sys.argv)>2 else None),ensure_ascii=False))
