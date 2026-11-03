async function readPlayersAt(context,event){
 const view=event.links.find(l=>/\/tournament\/\d+\//.test(l.href));
 const slug=event.name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 const host=/super\s*(1000|750|500|300|100)|world tour finals/i.test(event.category||'')?'bwfworldtour.bwfbadminton.com':'bwfbadminton.com';
 const url=view?new URL(view.href):new URL(`https://${host}/tournament/${event.id}/${slug}/`);
 url.pathname=(/^\/tournament\/\d+\/[^/]+/.exec(url.pathname)?.[0]||url.pathname.replace(/\/$/,''))+'/players';
 const page=await context.newPage();try{
 await page.route('**/*',route=>['image','font','media'].includes(route.request().resourceType())?route.abort():route.continue());
 const response=await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:45000});
 if(!response?.ok())throw Error(`Players source HTTP ${response?.status()}`);
 await page.addStyleTag({content:'#cookiescript_injected_wrapper { display:none !important; pointer-events:none !important; }'});
 await page.locator('.tmt-entry-outer-wrap').waitFor({state:'attached',timeout:12000});
 const normalize=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
 const title=[...await page.locator('.live-tournament-wrapper h2').allTextContents(),(await page.title()).replace(/^Tournament\s*\|\s*/i,'')];
 if(!title.some(t=>normalize(t)===normalize(event.name)))throw Error('Players page tournament identity mismatch');
 await page.locator('.event-stage:visible .player-ranking-grid:not(.header)').first().waitFor({state:'attached',timeout:20000});
 const tabs=page.locator('.event-tab');
 const selector=page.locator('.v-select').filter({has:page.getByText('Event',{exact:true})});
 const entries=[];
 for(const code of ['MS','WS','MD','WD','XD']){
   const label={MS:"Men's Singles",WS:"Women's Singles",MD:"Men's Doubles",WD:"Women's Doubles",XD:'Mixed Doubles'}[code];
   const modern=await tabs.count()>0;
   const current=modern?await page.locator('.event-tab.active').textContent():await selector.locator('.v-select__selection').innerText();
   if(current.trim()!==(modern?label:code)){
     const previous=await page.locator('.tmt-entry-outer-wrap').innerText();
     if(modern)await tabs.filter({hasText:new RegExp('^\\s*'+label+'\\s*$','i')}).click();else{await selector.getByRole('button').click();await page.getByRole('option',{name:code,exact:true}).click();}
     await page.waitForFunction(old=>document.querySelector('.tmt-entry-outer-wrap')?.innerText!==old,previous,{timeout:15000});
   }
   await page.locator('.event-stage:visible .player-ranking-grid:not(.header)').first().waitFor({state:'attached',timeout:20000});
   if((modern?await page.locator('.event-tab.active').textContent():await selector.locator('.v-select__selection').innerText()).trim()!==(modern?label:code))throw Error('Discipline selection could not be verified');
   const rows=await page.locator('.event-stage:visible').evaluateAll((stages,code)=>stages.flatMap(stage=>{
     const heading=stage.querySelector('h2')?.textContent.trim()||'';
     const elements=[...stage.querySelectorAll('.player-ranking-grid:not(.header)')];
     const expected=Number(/(\d+)\s+(?:players|pairs)/i.exec(heading)?.[1]);
     if(!Number.isFinite(expected)||expected!==elements.length)throw Error('Incomplete Players section');
     return elements.map(row=>{
       const clean=element=>{if(!element)return '';const copy=element.cloneNode(true);copy.querySelectorAll('.entry-player-status,.awards').forEach(b=>b.remove());return copy.textContent.replace(/\s+/g,' ').trim();};
       const names=[...row.querySelectorAll('.entry-player-info-wrap')].map(person=>[clean(person.querySelector('.entry-player-firstname')),clean(person.querySelector('.entry-player-lastname'))].filter(Boolean).join(' '));
       let status=row.querySelector('.no-column')?.childNodes[0]?.textContent.trim()||'';
       if(row.querySelector('.status-wdn'))status='Withdrawn';else if(row.querySelector('[title="Removed"]'))status='Removed';else if(/removed/i.test(heading))status='Removed';else if(/withdrawn/i.test(heading))status='Withdrawn';
       if(!/^(?:[MQR][1-9]\d*|Removed|Withdrawn)$/.test(status))throw Error('Entry position unavailable');
       if(names.length!==(code==='MS'||code==='WS'?1:2)||names.some(n=>!n))throw Error('Incomplete player/pair');
       return {discipline:code,names,status};
     });
   }),code);
   if(!rows.length)throw Error(`${code}: no entry rows`);
   // Promoted entries can appear in both their original list and Main with
   // the same published code. Keep one exact identity/status, not two rows.
   const unique=new Map(rows.map(row=>[row.status+'|'+[...row.names].sort().join('/'),row]));
   entries.push(...unique.values());
 }
 return{entries,source:url.href,sourceKind:'players'};
 }finally{await page.close();}
}


export async function readPlayers(context,event){
 const slug=event.name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 const known=event.links?.find(link=>/\/tournament\/\d+\//.test(link.href));
 const path=known?(/^\/tournament\/\d+\/[^/]+/.exec(new URL(known.href).pathname)?.[0]||`/tournament/${event.id}/${slug}`):`/tournament/${event.id}/${slug}`;
 const candidates=[`https://bwfworldtour.bwfbadminton.com${path}/`];
 if(known)candidates.push(known.href);
 candidates.push(`https://bwfbadminton.com${path}/`);
 const attempted=new Set();const errors=[];
 for(const href of candidates){
   const url=new URL(href);
   if(!['bwfbadminton.com','bwfworldtour.bwfbadminton.com'].includes(url.hostname)||attempted.has(url.hostname))continue;
   attempted.add(url.hostname);
   try{return await readPlayersAt(context,{...event,links:[{href:url.href}]});}catch(error){errors.push(`${url.hostname}: ${error.message.split('\n')[0]}`);}
 }
 throw Error(errors.join('; ')||'No usable official Players source');
}
