
'use client';
import {useState} from 'react';
import {UpcomingEntries} from '@/components/upcoming-entries';
import {PlayerSearch} from '@/components/player-search';
import {Button} from '@/components/ui/button';
import {RotateCcw} from 'lucide-react';
export default function UpcomingEntriesPage(){
 const [reset,setReset]=useState(0);
 return <main className="min-h-screen bg-background text-foreground">
  <header className="border-b border-border/70"><div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8"><h1 className="font-heading text-[22px] font-normal md:text-[36px]">UPCOMING TOURNAMENT ENTRIES <sup className="relative -top-2 text-xs font-medium text-primary">Beta</sup></h1><Button variant="outline" size="sm" aria-label="Reset entry lookup" onClick={()=>setReset(n=>n+1)}><RotateCcw/>Reset</Button></div></header>
  <section className="mx-auto max-w-[1440px] px-4 pb-7 sm:px-6 lg:px-8"><UpcomingEntries key={reset} renderPlayerSearch={(name,discipline,onChange)=><PlayerSearch player={{name}} index={0} disciplineCode={discipline} ariaLabel="Entry lookup player" onChange={onChange} onSelect={candidate=>onChange(candidate.name)}/>}/></section>
 </main>;
}
