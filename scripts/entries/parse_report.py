"""Read actual Type/Position columns; never substitute World Ranking for entry position."""
import json, re, sys
import pymupdf
DISCIPLINES = {"men's singles":"MS", "women's singles":"WS", "men's doubles":"MD", "women's doubles":"WD", "mixed doubles":"XD"}
STATUSES = {'Main':'M','Qualifying':'Q','Reserves':'R','Removed':'Removed','Withdrawn':'Withdrawn'}

def parse_report(filename):
    output=[]; discipline=None; columns=None; seen=set()
    for page_number,page in enumerate(pymupdf.open(filename),1):
        spans=[s for b in page.get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans'] if s['text'].strip()]
        headings=[(s['bbox'][1],DISCIPLINES[s['text'].strip().lower().replace('’',"'")]) for s in spans if s['text'].strip().lower().replace('’',"'") in DISCIPLINES]
        if len(set(code for _,code in headings))>1: raise ValueError(f'Page {page_number}: multiple discipline layouts require the Players fallback')
        if headings:
            new=sorted(headings)[0][1]
            if new!=discipline: columns=None
            discipline=new
        if not discipline: raise ValueError(f'Page {page_number}: discipline missing')
        last=sorted([s for s in spans if re.fullmatch(r'lastname(?:\s*[12])?',s['text'].strip(),re.I)],key=lambda s:s['bbox'][0])
        if last:
            columns=[]
            for s in last:
                stop=min(t['bbox'][0] for t in spans if t['bbox'][0]>s['bbox'][0] and abs(t['bbox'][1]-s['bbox'][1])<3 and re.match(r'(country|gender)',t['text'].strip(),re.I))
                columns.append((s['bbox'][0]-1,stop-1))
        if not columns or len(columns)!=(1 if discipline in ('MS','WS') else 2): raise ValueError(f'Page {page_number}: unsupported name columns')
        anchors=sorted([s for s in spans if s['text'].strip() in STATUSES],key=lambda s:s['bbox'][1])
        words=page.get_text('words')
        for i,s in enumerate(anchors):
            y=s['bbox'][1]; lo=(anchors[i-1]['bbox'][3]+y)/2 if i else y-2
            hi=(s['bbox'][3]+anchors[i+1]['bbox'][1])/2 if i+1<len(anchors) else s['bbox'][3]+2
            names=[]
            for left,right in columns:
                selected=sorted([w for w in words if left<=w[0]<right and lo<=w[1]<hi],key=lambda w:(round(w[1],1),w[0]))
                names.append(' '.join(w[4] for w in selected))
            if any(not name or not re.search(r'[A-Za-zÀ-ž]',name) for name in names): raise ValueError(f'Page {page_number}: incomplete identity')
            position=[w[4] for w in words if w[0]>s['bbox'][2] and abs(w[1]-y)<3 and w[4].isdigit()]
            status=s['text'].strip()
            if len(position)!=1 or (status in ('Main','Qualifying','Reserves') and int(position[0])<1): raise ValueError(f'Page {page_number}: invalid position')
            code=STATUSES[status]+position[0] if status in ('Main','Qualifying','Reserves') else STATUSES[status]
            identity=(discipline,code)
            if status in ('Main','Qualifying','Reserves') and identity in seen: raise ValueError(f'Duplicate {identity}')
            seen.add(identity)
            output.append({'discipline':discipline,'names':names,'status':code,'page':page_number})
    if set(e['discipline'] for e in output)!=set(DISCIPLINES.values()): raise ValueError('Report does not cover all five disciplines')
    return output

if __name__=='__main__': print(json.dumps(parse_report(sys.argv[1]),ensure_ascii=False))
