import { readPlayers } from './entries/players.mjs';
import { chromium } from 'playwright';
import { readFile,writeFile,mkdir,rename } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { latestReport,eventDates,inWindow } from './entries/core.mjs';
const root=new URL('../',import.meta.url), destination=new URL('lib/upcoming-entries.json',root);
const today=new Date().toISOString().slice(0,10), year=Number(today.slice(0,4));
const previous=await readFile(destination,'utf8').then(JSON.parse).catch(()=>({events:[]}));
const browser=await chromium.launch();
const context=await browser.newContext({userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'});
const now=()=>new Date().toISOString();
async function open(page,url){const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});if(!response?.ok()||/Just a moment|security verification/i.test(await page.title()))throw Error(`Source unavailable (HTTP ${response?.status()})`);}
async function calendar(y){
 const page=await context.newPage();try{
  const url=`https://corporate.bwfbadminton.com/events/calendar/${y}/remaining/0/-1/`;await open(page,url);
  await page.locator('table.tblResultLanding tr a[data-target]').first().waitFor({state:'attached',timeout:15000});
  const rows=await page.locator('table.tblResultLanding tr').evaluateAll(rows=>rows.flatMap(row=>{
   const cells=[...row.querySelectorAll(':scope > td')];const a=row.querySelector('a[data-target]');if(!a||cells.length<7)return[];
   const detail=document.getElementById(a.getAttribute('data-target').replace('#',''));
   return [{id:a.getAttribute('data-target').replace('#',''),name:a.textContent.trim(),week:cells[0].textContent.trim(),range:cells[2].textContent.trim(),category:cells[5].textContent.trim(),links:[...(detail?.querySelectorAll('a[href]')||[])].map(l=>({href:l.href,text:l.textContent.trim()}))}];
  }));
  if(!rows.length)throw Error('Calendar empty');
  return rows.filter(r=>!/junior|u19|u17|cancelled/i.test(r.name+' '+r.category)).map(r=>({...r,...eventDates(y,r.week,r.range),calendarUrl:url})).filter(r=>inWindow(r,today));
 }finally{await page.close();}
}
async function collect(event){
 const report=latestReport(event.links);let reportError;
 if(report){try{
  const response=await context.request.get(report.href,{timeout:45000});if(!response.ok())throw Error(`PDF HTTP ${response.status()}`);
  const body=await response.body();if(body.subarray(0,5).toString()!=='%PDF-')throw Error('Download is not a PDF');
  const dir=join(tmpdir(),'bwf-entry-pdfs');await mkdir(dir,{recursive:true});const file=join(dir,`${event.id}.pdf`);await writeFile(file,body);
  const entries=JSON.parse(execFileSync(process.env.PYTHON||'python3',[new URL('scripts/entries/parse_report.py',root).pathname,file],{maxBuffer:10*1024*1024,stdio:['ignore','pipe','pipe']}).toString());
  return{entries,source:report.href,sourceKind:'pdf',version:report.version};
 }catch(error){reportError=error.message.split('\n')[0];}}
 try{return await readPlayers(context,event);}catch(error){throw Error(`${reportError?`Latest report: ${reportError}; `:''}${error.message}`);}
}
try{
 const events=[];const calendarErrors=[];
 const end=new Date(today);end.setUTCDate(end.getUTCDate()+42);
 for(const y of new Set([year,end.getUTCFullYear()])){try{events.push(...await calendar(y));}catch(error){calendarErrors.push({year:y,message:error.message});}}
 if(!events.length&&calendarErrors.length)throw Error('No fresh calendar available; previous dataset preserved');
 const output=[];
 let next=0; await Promise.all(Array.from({length:1},async()=>{while(next<events.length){const event=events[next++];if(next>1)await new Promise(resolve=>setTimeout(resolve,1000));const {links,...base}=event;try{const result=await collect(event);output.push({...base,...result,state:'ready',checkedAt:now()});console.log(`${event.name}: ${result.entries.length} entries (${result.sourceKind})`);}catch(error){const cached=previous.events.find(e=>e.id===event.id&&e.entries?.length&&e.checkedAt);output.push({...base,...(cached?{entries:cached.entries,source:cached.source,sourceKind:cached.sourceKind,checkedAt:cached.checkedAt}:{}),state:cached?'stale':'unavailable',error:error.message});console.warn(`${event.name}: ${error.message}`);}}}));
 // Preserve knowledge of events if one calendar year is inaccessible.
 for(const cached of previous.events)if(calendarErrors.some(e=>Number(cached.start.slice(0,4))===e.year)&&inWindow(cached,today)&&!output.some(e=>e.id===cached.id))output.push({...cached,state:'stale'});
 const data={generatedAt:now(),windowStart:today,windowEnd:end.toISOString().slice(0,10),calendarErrors,events:output.sort((a,b)=>a.start.localeCompare(b.start)||a.name.localeCompare(b.name))};
 const temporary=new URL('lib/upcoming-entries.json.tmp',root);await writeFile(temporary,JSON.stringify(data,null,2)+'\n');await rename(temporary,destination);
 console.log(`Saved ${output.length} events; ${output.filter(e=>e.state==='ready').length} verified, ${output.filter(e=>e.state!=='ready').length} unavailable/stale`);
}finally{await browser.close();}
