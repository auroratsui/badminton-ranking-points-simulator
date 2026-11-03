export async function readPlayers(context,event){
 const view=event.links.find(l=>/\/tournament\/\d+\//.test(l.href));
 const slug=event.name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 const url=view?new URL(view.href):new URL(`https://bwfbadminton.com/tournament/${event.id}/${slug}/`);
 url.hostname='bwfbadminton.com';url.pathname=url.pathname.replace(/\/(players\/?)?$/,'/players');
 const page=await context.newPage();try{
 const response=await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:45000});
 if(!response?.ok())throw Error(`Players source HTTP ${response?.status()}`);
 await page.addStyleTag({content:'#cookiescript_injected_wrapper { display:none !important; pointer-events:none !important; }'});
 await page.locator('.tmt-entry-outer-wrap').waitFor({state:'attached',timeout:12000});
 const normalize=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
 const title=await page.locator('.live-tournament-wrapper h2').allTextContents();
 if(!title.some(t=>normalize(t)===normalize(event.name)))throw Error('Players page tournament identity mismatch');
 await page.locator('.event-stage .player-ranking-grid:not(.header)').first().waitFor({state:'attached',timeout:20000});
 const selector=page.locator('.v-select').filter({has:page.getByText('Event',{exact:true})});
 const entries=[];
 for(const code of ['MS','WS','MD','WD','XD']){
   const current=await selector.locator('.v-select__selection').innerText();
   if(current.trim()!==code){
     const previous=await page.locator('.tmt-entry-outer-wrap').innerText();
     await selector.getByRole('button').click();await page.getByRole('option',{name:code,exact:true}).click();
     await page.waitForFunction(old=>document.querySelector('.tmt-entry-outer-wrap')?.innerText!==old,previous,{timeout:15000});
   }
   await page.locator('.event-stage .player-ranking-grid:not(.header)').first().waitFor({state:'attached',timeout:20000});
   if((await selector.locator('.v-select__selection').innerText()).trim()!==code)throw Error('Discipline selection could not be verified');
   const rows=await page.locator('.event-stage').evaluateAll((stages,code)=>stages.flatMap(stage=>{
     const heading=stage.querySelector('h2')?.textContent.trim()||'';
     const elements=[...stage.querySelectorAll('.player-ranking-grid:not(.header)')];
     const expected=Number(/(\d+)\s+(?:players|pairs)/i.exec(heading)?.[1]);
     if(!Number.isFinite(expected)||expected!==elements.length)throw Error('Incomplete Players section');
     return elements.map(row=>{
       const names=[...row.querySelectorAll('.entry-player-info-wrap')].map(person=>[person.querySelector('.entry-player-firstname')?.textContent.trim(),person.querySelector('.entry-player-lastname')?.textContent.trim()].filter(Boolean).join(' '));
       let status=row.querySelector('.no-column')?.childNodes[0]?.textContent.trim()||'';
       if(/removed/i.test(heading))status='Removed';else if(/withdrawn/i.test(heading))status='Withdrawn';
       if(!/^(?:[MQR][1-9]\d*|Removed|Withdrawn)$/.test(status))throw Error('Entry position unavailable');
       if(names.length!==(code==='MS'||code==='WS'?1:2)||names.some(n=>!n))throw Error('Incomplete player/pair');
       return {discipline:code,names,status};
     });
   }),code);
   if(!rows.length)throw Error(`${code}: no entry rows`);
   const keys=rows.filter(r=>/^[MQR]/.test(r.status)&&r.status!=='Removed').map(r=>r.status+'|'+[...r.names].sort().join('/'));
   if(new Set(keys).size!==keys.length)throw Error('Duplicate entry identities');
   entries.push(...rows);
 }
 return{entries,source:url.href,sourceKind:'players'};
 }finally{await page.close();}
}
