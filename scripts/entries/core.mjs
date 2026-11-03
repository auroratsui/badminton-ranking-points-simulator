export function latestReport(links) {
  return links.filter(l=>/\.pdf(?:$|[?#])/i.test(l.href) && /(?:m\s*[&_\-/]\s*q|main\s*(?:and|&)\s*qualif)/i.test(l.text+' '+decodeURIComponent(l.href)))
    .map((l,i)=>({...l,order:i,version:Number(/(?:version|ver\.?|\bv)\s*[-_ ]*(\d+)/i.exec(l.text+' '+decodeURIComponent(l.href))?.[1]||0)}))
    .sort((a,b)=>b.version-a.version||b.order-a.order)[0];
}
export function eventDates(year, week, range) {
 const nums=range.match(/\d+/g)?.map(Number); if(!nums||nums.length<2) throw Error('Missing event dates');
 const jan4=new Date(Date.UTC(year,0,4)); const monday=new Date(+jan4-((jan4.getUTCDay()+6)%7)*86400000+(Number(week)-1)*7*86400000);
 let start; for(let i=0;i<7;i++){const d=new Date(+monday+i*86400000);if(d.getUTCDate()===nums[0])start=d;}
 if(!start)throw Error('Dates do not agree with calendar week');
 let end;for(let i=0;i<32;i++){const d=new Date(+start+i*86400000);if(d.getUTCDate()===nums[1]){end=d;break;}}
 if(!end)throw Error('Invalid event end');return {start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
}
export function inWindow(event,today){const end=new Date(today+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+42);return event.end>=today&&event.start<=end.toISOString().slice(0,10);}
