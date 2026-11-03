'use client';
import {useEffect,useState,type ReactNode} from 'react';
import {sameRaceName} from '@/lib/race-to-finals';
import dataset from '@/lib/upcoming-entries.json';
import {NativeSelect,NativeSelectOption} from '@/components/ui/native-select';
import {Card,CardContent} from '@/components/ui/card';
type Entry={discipline:string;names:string[];status:string;page?:number};
type Event={id:string;name:string;start:string;end:string;state:string;source?:string;checkedAt?:string;entries?:Entry[];error?:string;calendarUrl:string};
const data=dataset as {generatedAt:string;windowStart:string;windowEnd:string;calendarErrors:{year:number;message:string}[];events:Event[]};
export function UpcomingEntries({renderPlayerSearch}:{renderPlayerSearch:(name:string,discipline:string,onChange:(name:string)=>void)=>ReactNode}){
 const [query,setQuery]=useState('');const [discipline,setDiscipline]=useState('WS');const [today,setToday]=useState(data.windowStart);
 useEffect(()=>setToday(new Date().toISOString().slice(0,10)),[]);
 const end=new Date(today+'T00:00:00Z');end.setUTCDate(end.getUTCDate()+42);const until=end.toISOString().slice(0,10);
 const events=data.events.filter(e=>e.end>=today&&e.start<=until);
 const matches=events.flatMap(event=>(event.entries||[]).filter(entry=>entry.discipline===discipline&&(sameRaceName(query.trim(),entry.names.join(' / '))||entry.names.some(name=>sameRaceName(query.trim(),name)))).map(entry=>({event,entry})));
 const unavailable=events.filter(e=>e.state!=='ready');
 const old=!data.generatedAt||Date.now()-Date.parse(data.generatedAt)>48*3600000;
 return <div className="space-y-4 pt-4">
  <h2 className="font-heading text-xl font-semibold">UPCOMING TOURNAMENT ENTRIES</h2>
  <p className="text-[15px] text-muted-foreground">Find a player or pair’s published entries for the coming six weeks. Choose a discipline, then type a full name or select a top 200 player/pair.</p>
  <p className="text-xs text-muted-foreground">{today} – {until} · Last collection: {data.generatedAt?new Date(data.generatedAt).toLocaleString('en-GB',{timeZone:'UTC'})+' UTC':'Not yet collected'}</p>
  {(old||data.calendarErrors.length>0)&&<p role="status" className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm">{old?'Entry data needs a refresh. ':''}{data.calendarErrors.length?'Some calendar sources could not be checked. ':''}Coverage may be incomplete; a missing match does not confirm non-entry.</p>}
  <Card><CardContent className="grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
   <label className="grid gap-1 text-sm">Discipline<NativeSelect aria-label="Entry lookup discipline" value={discipline} onChange={e=>setDiscipline(e.target.value)}>{[['MS','Men’s Singles'],['WS','Women’s Singles'],['MD','Men’s Doubles'],['WD','Women’s Doubles'],['XD','Mixed Doubles']].map(([code,label])=><NativeSelectOption key={code} value={code}>{label}</NativeSelectOption>)}</NativeSelect></label>
   <div className="grid min-w-0 content-start gap-1 text-sm font-medium text-muted-foreground"><span>Player / Pair</span>{renderPlayerSearch(query,discipline,setQuery)}</div>
  </CardContent></Card>
  {query.trim()&&<Card><CardContent className="space-y-3"><h3 className="font-medium">Published entries</h3>{matches.length?<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="py-2 pr-4">Tournament</th><th className="pr-4">Dates</th><th className="pr-4">Entry</th></tr></thead><tbody>{matches.map(({event,entry},i)=><tr key={event.id+'-'+i} className="border-t"><td className="py-3 pr-4">{event.name}{event.state!=='ready'&&<span className="block text-xs text-amber-700">{event.state==='partial'?'Image report · partial coverage':'Previous list'} · checked {event.checkedAt?.slice(0,10)}</span>}</td><td className="pr-4 whitespace-nowrap">{event.start} – {event.end}</td><td className="pr-4 font-semibold">{entry.status}</td></tr>)}</tbody></table></div>:<p className="text-sm text-muted-foreground">No matching entries in the published lists checked. Use the full name and correct discipline; see unavailable lists below.</p>}<p className="text-xs text-muted-foreground">M = Main · Q = Qualifying · R = Reserves. The number is the published position within that list. Removed and Withdrawn are shown as published.</p></CardContent></Card>}
  <Card><CardContent className="space-y-3"><h3 className="font-medium">Entry-list coverage · {events.filter(e=>(e.entries?.length??0)>0).length} of {events.length} tournaments with usable entries · {events.filter(e=>e.state==='ready').length} complete lists</h3>{!events.length&&<p className="text-sm text-muted-foreground">No current event data is available. Please check again after the next refresh.</p>}{unavailable.map(event=><div key={event.id} className="border-t pt-2 text-sm"><span>{event.name}</span><span className="ml-2 text-muted-foreground">{event.state==='partial'?'Partial image report; some entries could not be verified':event.state==='stale'?'Refresh unavailable; previous list retained':/HTTP 403/.test(event.error||'')?'Source access blocked; entries could not be checked':'Entry list could not be read or has not been published'}</span></div>)}<details className="text-sm"><summary className="cursor-pointer">All tournaments checked</summary><ul className="mt-2 space-y-1">{events.map(event=><li key={event.id}>{event.name} · {event.state==='ready'?'Verified list':event.state==='partial'?'Partial image report':event.state==='stale'?'Stale list':'Unavailable'}</li>)}</ul></details></CardContent></Card>
 </div>;
}
