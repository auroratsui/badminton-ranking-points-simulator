'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  ChevronRight,
  CircleHelp,
  Plus,
  RotateCcw,
  Table2,
  Trash2,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { rankingMeta, rankingPlayers, type RankingPlayer } from '@/lib/ranking-data';
import rankingBreakdownsJson from '@/lib/ranking-breakdowns.json';
import tournamentCalendarsJson from '@/lib/tournament-calendars.json';

type RoundKey =
  | 'winner' | 'runnerUp' | 'semi' | 'quarter' | 'r16' | 'r32'
  | 'r64' | 'r128' | 'r256'
  | 'olympicBronze' | 'olympicFourth' | 'finalsGroupThird' | 'finalsGroupFourth';

type LevelKey =
  | 'worldChampionships' | 'olympics' | 'asianGames' | 'finals' | 'chinaOpen'
  | 'super1000' | 'super750' | 'super500' | 'super300' | 'super100'
  | 'challenge' | 'series' | 'future';

type Score = {
  id: string;
  label: string;
  points: number;
  week: string;
  href: string;
  result: string;
  bwfValid: boolean;
  team: boolean;
};

type Player = {
  id: string;
  name: string;
  discipline: string;
  result: RoundKey;
  manualTeamAward: number;
  scores: Score[];
  snapshotPoints?: number;
  snapshotRank?: number;
  snapshotTournaments?: number;
  sourceHref?: string;
  rankingKey?: string;
};

type RankingBreakdown = {
  name: string;
  profiles: string[];
  scores: Array<{
    week: string;
    label: string;
    href: string;
    result: string;
    points: number;
    valid: boolean;
  }>;
};

type TournamentEntry = {
  id: string;
  year: number;
  week: string;
  name: string;
  category: string;
  city: string;
};

type TournamentCalendarData = {
  generatedAt: string;
  calendars: Record<string, Array<Omit<TournamentEntry, 'id' | 'year'>>>;
};

type CurrentTournamentEntry = TournamentEntry & {
  eventType: 'individual' | 'team';
  level: LevelKey | null;
};

const rankingBreakdowns = rankingBreakdownsJson as Record<string, RankingBreakdown>;
const tournamentCalendars = tournamentCalendarsJson as TournamentCalendarData;

const roundOrder: RoundKey[] = ['winner', 'runnerUp', 'semi', 'quarter', 'r16', 'r32', 'r64', 'r128', 'r256'];

const roundLabels: Record<RoundKey, string> = {
  winner: 'Winner', runnerUp: 'Runner-up', semi: 'Semifinal (3–4)', quarter: 'Quarterfinal (5–8)',
  r16: 'Round of 16', r32: 'Round of 32', r64: 'Round of 64', r128: 'Round of 128',
  r256: 'Round of 256',
  olympicBronze: 'Olympic Bronze', olympicFourth: 'Olympic Fourth Place',
  finalsGroupThird: 'Finals Group — 3rd', finalsGroupFourth: 'Finals Group — 4th',
};

const levels: Record<LevelKey, { label: string; short: string; points: number[] }> = {
  worldChampionships: { label: 'World Championships', short: 'World Championships', points: [14500, 12500, 10500, 8200, 6000, 3700, 1450, 750, 300] },
  olympics: { label: 'Olympics', short: 'Olympics', points: [14500, 12500, 10500, 8200, 6000, 3700, 1450, 750, 300] },
  asianGames: { label: 'Asian Games', short: 'Asian Games', points: [12000, 10200, 8400, 6600, 4800, 3000, 1200, 600, 240] },
  finals: { label: 'World Tour Finals', short: 'World Tour Finals', points: [14000, 12000, 10000, 0, 5700, 3500, 1400, 720, 280] },
  chinaOpen: { label: 'Super 1000 (China Open)', short: 'Super 1000 · China Open', points: [13500, 11500, 9500, 7400, 5400, 3300, 1350, 670, 270] },
  super1000: { label: 'Super 1000 (Non-China Open)', short: 'Super 1000 · Non-China Open', points: [12000, 10200, 8400, 6600, 4800, 3000, 1200, 600, 240] },
  super750: { label: 'Super 750', short: 'Super 750', points: [11000, 9350, 7700, 6050, 4320, 2660, 1060, 520, 210] },
  super500: { label: 'Super 500', short: 'Super 500', points: [9200, 7800, 6420, 5040, 3600, 2220, 880, 430, 170] },
  super300: { label: 'Super 300', short: 'Super 300', points: [7000, 5950, 4900, 3850, 2750, 1670, 660, 320, 130] },
  super100: { label: 'Super 100', short: 'Super 100', points: [5500, 4680, 3850, 3030, 2110, 1290, 510, 240, 100] },
  challenge: { label: 'International Challenge', short: 'International Challenge', points: [4000, 3400, 2800, 2200, 1520, 920, 360, 170, 70] },
  series: { label: 'International Series', short: 'International Series', points: [2500, 2130, 1750, 1370, 920, 550, 210, 100, 40] },
  future: { label: 'Future Series', short: 'Future Series', points: [1700, 1420, 1170, 920, 600, 350, 130, 60, 20] },
};

const initialPlayers: Player[] = [
  { id: 'player-1', name: '', discipline: '', result: 'quarter', manualTeamAward: 0, scores: [] },
];
const disciplineOptions = [
  { code: 'MS', label: 'Men’s Singles' },
  { code: 'WS', label: 'Women’s Singles' },
  { code: 'MD', label: 'Men’s Doubles' },
  { code: 'WD', label: 'Women’s Doubles' },
  { code: 'XD', label: 'Mixed Doubles' },
] as const;
type DisciplineCode = typeof disciplineOptions[number]['code'];

const standardOutcomeRounds: Array<{ key: RoundKey; label: string }> = [
  { key: 'winner', label: 'Winner' },
  { key: 'runnerUp', label: 'Runner-up' },
  { key: 'semi', label: 'SF' },
  { key: 'quarter', label: 'QF' },
  { key: 'r16', label: 'R16' },
  { key: 'r32', label: 'R32' },
];

function outcomeRoundsFor(level: LevelKey): Array<{ key: RoundKey; label: string }> {
  if (level === 'finals') return [
    { key: 'winner', label: 'Winner' },
    { key: 'runnerUp', label: 'Runner-up' },
    { key: 'semi', label: 'SF' },
    { key: 'finalsGroupThird', label: '3rd in Grp' },
    { key: 'finalsGroupFourth', label: '4th in Grp' },
  ];
  if (level === 'worldChampionships' || level === 'olympics' || level === 'asianGames') {
    return [...standardOutcomeRounds, { key: 'r64', label: 'R64' }];
  }
  return standardOutcomeRounds;
}

const fmt = (value: number) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(Math.round(value));

function isoWeekStart(value: string) {
  const match = /^(\d{4})-W(\d{1,2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (week - 1) * 7);
  return monday;
}

function isoWeekValue(date: Date) {
  const target = new Date(date);
  target.setUTCDate(target.getUTCDate() + 3 - ((target.getUTCDay() + 6) % 7));
  const weekYear = target.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(weekYear, 0, 4));
  firstThursday.setUTCDate(firstThursday.getUTCDate() + 3 - ((firstThursday.getUTCDay() + 6) % 7));
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / 604800000);
  return `${weekYear}-W${String(week).padStart(2, '0')}`;
}

function futureTournamentWeeks(startWeek: string) {
  const start = isoWeekStart(startWeek);
  if (!start) return [];
  const finalYear = Number(startWeek.slice(0, 4)) + 1;
  const weeks: string[] = [];

  for (let offset = 0; offset < 106; offset += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + offset * 7);
    const value = isoWeekValue(date);
    if (Number(value.slice(0, 4)) > finalYear) break;
    weeks.push(value);
  }

  return weeks;
}

function isExpired(scoreWeek: string, updateWeek: string) {
  const score = isoWeekStart(scoreWeek);
  const update = isoWeekStart(updateWeek);
  if (!score || !update) return false;
  return Math.floor((update.getTime() - score.getTime()) / 604800000) >= 52;
}

function isTeamTournament(label: string) {
  return /thomas|uber|sudirman|team championships?|team event|mixed team|men's team|women's team/i.test(label);
}

function eventTypeForTournament(tournament: Omit<TournamentEntry, 'id' | 'year'>) {
  return isTeamTournament(`${tournament.name} ${tournament.category}`) ? 'team' as const : 'individual' as const;
}

function levelForTournament(tournament: Omit<TournamentEntry, 'id' | 'year'>): LevelKey | null {
  const value = `${tournament.name} ${tournament.category}`.toLocaleLowerCase();
  if (value.includes('world tour finals')) return 'finals';
  if (value.includes('world championships')) return 'worldChampionships';
  if (value.includes('olympic games')) return 'olympics';
  if (value.includes('asian games')) return 'asianGames';
  if (value.includes('china open') && value.includes('super 1000')) return 'chinaOpen';
  if (value.includes('super 1000')) return 'super1000';
  if (value.includes('super 750')) return 'super750';
  if (value.includes('super 500')) return 'super500';
  if (value.includes('super 300')) return 'super300';
  if (value.includes('super 100')) return 'super100';
  if (value.includes('international challenge')) return 'challenge';
  if (value.includes('international series')) return 'series';
  if (value.includes('future series')) return 'future';
  return null;
}

const genericTournamentWords = new Set([
  'badminton', 'bwf', 'championship', 'championships', 'challenge', 'cup', 'future',
  'grand', 'individual', 'international', 'masters', 'open', 'prix', 'series',
  'super', 'team', 'the', 'tour', 'tournament', 'world',
]);

function tournamentNameTokens(name: string) {
  return name
    .replace(/\b(?:presented|powered|sponsored)\s+by\b.*$/i, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(?:19|20)\d{2}\b/g, ' ')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function commonSuffixLength(left: string[], right: string[]) {
  let length = 0;
  while (length < left.length && length < right.length && left[left.length - 1 - length] === right[right.length - 1 - length]) length += 1;
  return length;
}

function normalizedPlace(value: string) {
  return value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function previousEditionMatch(current: CurrentTournamentEntry, candidates: TournamentEntry[]) {
  const sameEventType = candidates.filter((candidate) => eventTypeForTournament(candidate) === current.eventType);
  const currentTokens = tournamentNameTokens(current.name);
  const currentKey = currentTokens.join(' ');
  const currentLevel = current.level;
  const exactSameLevel = sameEventType.find((candidate) => {
    const candidateLevel = levelForTournament(candidate);
    return tournamentNameTokens(candidate.name).join(' ') === currentKey && candidateLevel === currentLevel;
  });
  if (exactSameLevel) return exactSameLevel;

  const currentSignificant = currentTokens.filter((token) => !genericTournamentWords.has(token));
  const scored = sameEventType.map((candidate) => {
    const candidateTokens = tournamentNameTokens(candidate.name);
    const candidateSignificant = candidateTokens.filter((token) => !genericTournamentWords.has(token));
    const sharedSignificant = new Set(currentSignificant.filter((token) => candidateSignificant.includes(token))).size;
    const sameCity = Boolean(current.city && candidate.city && normalizedPlace(current.city) === normalizedPlace(candidate.city));
    if (!sharedSignificant && !sameCity) return { candidate, score: -1 };
    const overlap = sharedSignificant / Math.max(1, Math.min(currentSignificant.length, candidateSignificant.length));
    const exactName = candidateTokens.join(' ') === currentKey;
    const sameLevel = levelForTournament(candidate) === currentLevel;
    const score = (exactName ? 500 : 0)
      + commonSuffixLength(currentTokens, candidateTokens) * 20
      + overlap * 40
      + (sameCity ? 20 : 0)
      + (sameLevel ? 20 : 0);
    return { candidate, score };
  }).sort((left, right) => right.score - left.score);

  return scored[0]?.score >= 55 ? scored[0].candidate : null;
}

function countableScores(scores: Score[]) {
  const individuals = scores.filter((score) => !score.team && score.points > 0);
  const bestTeam = scores.filter((score) => score.team && score.points > 0).sort((a, b) => b.points - a.points)[0];
  return [...individuals, ...(bestTeam ? [bestTeam] : [])].sort((a, b) => b.points - a.points).slice(0, 10);
}

function awardFor(level: LevelKey, round: RoundKey) {
  if (round === 'olympicBronze') return 11500;
  if (round === 'olympicFourth') return 10500;
  if (round === 'finalsGroupThird') return 8900;
  if (round === 'finalsGroupFourth') return 7800;
  return levels[level].points[roundOrder.indexOf(round)] ?? 0;
}

function roundsFor(level: LevelKey): RoundKey[] {
  if (level === 'olympics') return ['winner', 'runnerUp', 'olympicBronze', 'olympicFourth', 'quarter', 'r16', 'r32', 'r64', 'r128', 'r256'];
  if (level === 'finals') return ['winner', 'runnerUp', 'semi', 'finalsGroupThird', 'finalsGroupFourth', 'r16', 'r32'];
  if (level === 'chinaOpen' || level === 'super1000' || level === 'super750') return roundOrder.slice(0, 6);
  return roundOrder;
}

function isReplacedBy(score: Score, tournament: TournamentEntry | null) {
  return Boolean(tournament) && score.week === `${tournament?.year}-W${tournament?.week.padStart(2, '0')}`;
}

function calculate(player: Player, level: LevelKey, tournamentWeek: string, eventType: 'individual' | 'team', previousEdition: TournamentEntry | null) {
  const beforeScores = player.scores.filter((score) => score.bwfValid);
  const hasBreakdown = player.scores.some((score) => score.points > 0);
  const before = player.snapshotPoints ?? beforeScores.reduce((total, score) => total + score.points, 0);
  const removed = player.scores.filter((score) => isReplacedBy(score, previousEdition) || isExpired(score.week, tournamentWeek));
  const retained = player.scores.filter((score) => !isReplacedBy(score, previousEdition) && !isExpired(score.week, tournamentWeek));
  const award = eventType === 'team' ? player.manualTeamAward : awardFor(level, player.result);
  const newScore: Score = { id: `new-${player.id}`, label: 'Projected tournament', points: award, week: tournamentWeek, href: '', result: roundLabels[player.result], bwfValid: false, team: eventType === 'team' };
  const afterScores = countableScores(award > 0 ? [...retained, newScore] : retained);
  const after = hasBreakdown ? afterScores.reduce((total, score) => total + score.points, 0) : before;
  const newCounts = afterScores.some((score) => score.id === newScore.id);
  const dropped = beforeScores.filter((score) => !afterScores.some((next) => next.id === score.id));
  const cutoff = afterScores.length ? afterScores[afterScores.length - 1].points : 0;
  return { before, after, change: after - before, award, newCounts, removed, dropped, cutoff, beforeScores, afterScores, hasBreakdown };
}

function scoresFor(candidate: RankingPlayer) {
  const rankingKey = `${candidate.code}-${candidate.rank}`;
  const breakdown = rankingBreakdowns[rankingKey];
  return {
    rankingKey,
    scores: (breakdown?.scores ?? [])
      .filter((score) => score.points > 0)
      .map((score, index): Score => ({
        id: `${rankingKey}-${index}`,
        label: score.label,
        points: score.points,
        week: score.week,
        href: score.href,
        result: score.result,
        bwfValid: score.valid,
        team: isTeamTournament(score.label),
      })),
  };
}

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function outcomeTableName(candidate: RankingPlayer) {
  if (!['MD', 'WD', 'XD'].includes(candidate.code)) return candidate.name;
  return candidate.name.split(' / ').map((member) => {
    const parts = member.trim().split(/\s+/);
    const surnames = parts.filter((part) => /\p{L}/u.test(part) && part === part.toLocaleUpperCase());
    return surnames.join(' ') || parts.at(-1) || member;
  }).join(' / ');
}

function PlayerSearch({ player, onChange, onSelect, index }: {
  player: Player;
  onChange: (value: string) => void;
  onSelect: (candidate: RankingPlayer) => void;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  const query = player.name.trim().toLocaleLowerCase();
  const suggestions = rankingPlayers
    .filter((candidate) => !query || candidate.name.toLocaleLowerCase().includes(query))
    .sort((a, b) => {
      const aStarts = a.name.toLocaleLowerCase().startsWith(query) ? 0 : 1;
      const bStarts = b.name.toLocaleLowerCase().startsWith(query) ? 0 : 1;
      return aStarts - bStarts || a.rank - b.rank;
    })
    .slice(0, 12);

  return (
    <div className="relative">
      <Input
        value={player.name}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(event) => { onChange(event.target.value); setOpen(true); }}
        aria-label={`Player ${index + 1} name`}
        aria-autocomplete="list"
        aria-expanded={open}
        className="font-medium text-foreground"
        placeholder="Start typing player’s name here"
      />
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border bg-popover shadow-xl">
          <Command shouldFilter={false}>
            <CommandList className="max-h-72">
              <CommandEmpty>No top-100 player or pair found.</CommandEmpty>
              {suggestions.map((candidate) => (
                <CommandItem
                  key={`${candidate.code}-${candidate.rank}-${candidate.name}`}
                  value={`${candidate.code}-${candidate.rank}-${candidate.name}`}
                  onSelect={() => { onSelect(candidate); setOpen(false); }}
                  className="grid grid-cols-[38px_1fr_auto] gap-2 px-3 py-2.5"
                >
                  <Badge variant="secondary">{candidate.code}</Badge>
                  <span className="min-w-0"><span className="block truncate font-medium">{candidate.name}</span><span className="block text-[11px] text-muted-foreground">World No. {candidate.rank} · {candidate.tournaments} tournaments</span></span>
                  <span className="text-xs tabular-nums text-muted-foreground">{fmt(candidate.points)}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}

function TournamentSearch({ options, value, year, onSelect }: {
  options: TournamentEntry[];
  value: string;
  year: number;
  onSelect: (value: string) => void;
}) {
  const selected = options.find((option) => option.id === value);
  const [query, setQuery] = useState(selected?.name ?? '');
  const [open, setOpen] = useState(false);
  useEffect(() => setQuery(selected?.name ?? ''), [selected?.name]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const suggestions = options
    .filter((option) => !normalizedQuery || `${option.name} ${option.category} ${option.city}`.toLocaleLowerCase().includes(normalizedQuery))
    .sort((a, b) => {
      const aStarts = a.name.toLocaleLowerCase().startsWith(normalizedQuery) ? 0 : 1;
      const bStarts = b.name.toLocaleLowerCase().startsWith(normalizedQuery) ? 0 : 1;
      return aStarts - bStarts || Number(a.week) - Number(b.week) || a.name.localeCompare(b.name);
    });

  return (
    <div className="relative">
      <Input
        value={selected?.name ?? query}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(event) => { setQuery(event.target.value); onSelect(''); setOpen(true); }}
        aria-label={`Previous edition from ${year}`}
        aria-autocomplete="list"
        aria-expanded={open}
        placeholder={`Start typing a ${year} tournament`}
      />
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 min-w-0 overflow-hidden rounded-xl border bg-popover shadow-xl sm:min-w-[22rem]">
          <Command shouldFilter={false}>
            <CommandList className="max-h-80 overscroll-contain">
              <CommandEmpty>No {year} BWF tournament found.</CommandEmpty>
              {suggestions.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.id}
                  onSelect={() => { onSelect(option.id); setQuery(option.name); setOpen(false); }}
                  className="grid grid-cols-[42px_1fr] gap-2 px-3 py-2.5"
                >
                  <Badge variant="secondary">W{option.week}</Badge>
                  <span className="min-w-0"><span className="block truncate font-medium">{option.name}</span><span className="block truncate text-[11px] text-muted-foreground">{option.category}{option.city ? ` · ${option.city}` : ''}</span></span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}

function CurrentTournamentSearch({ options, value, onSelect }: {
  options: CurrentTournamentEntry[];
  value: string;
  onSelect: (tournament: CurrentTournamentEntry | null) => void;
}) {
  const selected = options.find((option) => option.id === value);
  const [query, setQuery] = useState(selected?.name ?? '');
  const [open, setOpen] = useState(false);
  useEffect(() => setQuery(selected?.name ?? ''), [selected?.name]);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const suggestions = options
    .filter((option) => !normalizedQuery || `${option.name} ${option.category} ${option.city}`.toLocaleLowerCase().includes(normalizedQuery))
    .sort((a, b) => {
      const aStarts = a.name.toLocaleLowerCase().startsWith(normalizedQuery) ? 0 : 1;
      const bStarts = b.name.toLocaleLowerCase().startsWith(normalizedQuery) ? 0 : 1;
      return aStarts - bStarts || Number(a.week) - Number(b.week) || a.name.localeCompare(b.name);
    });

  return (
    <div className="relative">
      <Input
        value={selected?.name ?? query}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(event) => { setQuery(event.target.value); onSelect(null); setOpen(true); }}
        aria-label="Tournament Name"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-required="true"
        placeholder="Start typing a tournament name"
      />
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 min-w-0 overflow-hidden rounded-xl border bg-popover shadow-xl sm:min-w-[26rem]">
          <Command shouldFilter={false}>
            <CommandList className="max-h-80 overscroll-contain">
              <CommandEmpty>No current or upcoming senior BWF tournament found.</CommandEmpty>
              {suggestions.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.id}
                  onPointerDown={(event) => event.preventDefault()}
                  onSelect={() => { onSelect(option); setQuery(option.name); setOpen(false); }}
                  className="grid grid-cols-[42px_1fr] gap-2 px-3 py-2.5"
                >
                  <Badge variant="secondary">W{option.week}</Badge>
                  <span className="min-w-0"><span className="block truncate font-medium">{option.name}</span><span className="block truncate text-[11px] text-muted-foreground">{option.category}{option.city ? ` · ${option.city}` : ''}</span></span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}

const defaultTournamentWeek = `${rankingMeta.date.slice(0, 4)}-W${String(rankingMeta.week).padStart(2, '0')}`;
const tournamentWeekOptions = futureTournamentWeeks(defaultTournamentWeek);
const currentTournamentYear = Number(rankingMeta.date.slice(0, 4));
const currentTournamentOptions: CurrentTournamentEntry[] = (tournamentCalendars.calendars[String(currentTournamentYear)] ?? [])
  .filter((tournament) => Number(tournament.week) >= rankingMeta.week)
  .filter((tournament) => !tournament.category.toLocaleLowerCase().includes('junior'))
  .filter((tournament) => !tournament.name.toLocaleLowerCase().includes('cancelled'))
  .map((tournament, index) => ({
    ...tournament,
    id: `${currentTournamentYear}-${tournament.week}-${index}`,
    year: currentTournamentYear,
    eventType: eventTypeForTournament(tournament),
    level: levelForTournament(tournament),
  }))
  .filter((tournament) => tournament.eventType === 'team' || tournament.level !== null);

export default function Home() {
  const [level, setLevel] = useState<LevelKey>('super750');
  const [eventType, setEventType] = useState<'individual' | 'team'>('individual');
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [tournamentWeek, setTournamentWeek] = useState(defaultTournamentWeek);
  const [previousEdition, setPreviousEdition] = useState('');
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [outcomeDiscipline, setOutcomeDiscipline] = useState<DisciplineCode>('MS');
  const [showOutcomeTable, setShowOutcomeTable] = useState(false);

  const selectedTournament = currentTournamentOptions.find((option) => option.id === selectedTournamentId) ?? null;
  const winnerAward = levels[level].points[0];
  const validTournamentWeek = Boolean(isoWeekStart(tournamentWeek));
  const tournamentYear = Number(tournamentWeek.slice(0, 4)) || Number(rankingMeta.date.slice(0, 4));
  const previousYear = tournamentYear - 1;
  const previousEditionOptions = useMemo(() => (tournamentCalendars.calendars[String(previousYear)] ?? [])
    .filter((tournament) => !tournament.category.toLocaleLowerCase().includes('junior'))
    .map((tournament, index) => ({ ...tournament, year: previousYear, id: `${previousYear}-${tournament.week}-${index}` })), [previousYear]);
  const selectedPreviousEdition = previousEditionOptions.find((option) => option.id === previousEdition) ?? null;
  const summaries = useMemo(() => players.map((player) => ({ player, result: calculate(player, level, tournamentWeek, eventType, selectedPreviousEdition) })), [players, level, tournamentWeek, eventType, selectedPreviousEdition]);
  const outcomeTableRounds = useMemo(() => outcomeRoundsFor(level), [level]);
  const outcomeRows = useMemo(() => rankingPlayers
    .filter((candidate) => candidate.code === outcomeDiscipline && candidate.rank <= 8)
    .sort((left, right) => left.rank - right.rank)
    .map((candidate) => {
      const automatic = scoresFor(candidate);
      const basePlayer: Player = {
        id: `outcome-${candidate.code}-${candidate.rank}`,
        name: candidate.name,
        discipline: candidate.discipline,
        result: 'winner',
        manualTeamAward: 0,
        scores: automatic.scores,
        snapshotPoints: candidate.points,
        snapshotRank: candidate.rank,
        snapshotTournaments: candidate.tournaments,
        rankingKey: automatic.rankingKey,
      };
      return {
        candidate,
        displayName: outcomeTableName(candidate),
        totals: outcomeTableRounds.map((round) => calculate({ ...basePlayer, result: round.key }, level, tournamentWeek, eventType, selectedPreviousEdition).after),
      };
    }), [outcomeDiscipline, level, tournamentWeek, eventType, selectedPreviousEdition, outcomeTableRounds]);

  const patchPlayer = (id: string, patch: Partial<Player>) => setPlayers((current) => current.map((player) => player.id === id ? { ...player, ...patch } : player));
  const changeLevel = (nextLevel: LevelKey) => {
    setLevel(nextLevel);
    const availableRounds = roundsFor(nextLevel);
    setPlayers((current) => current.map((player) => availableRounds.includes(player.result) ? player : { ...player, result: availableRounds[0] }));
  };

  const addPlayer = () => setPlayers((current) => current.length >= 10
    ? current
    : [...current, { id: newId('player'), name: '', discipline: '', result: 'quarter', manualTeamAward: 0, scores: [] }]);

  const selectTournament = (tournament: CurrentTournamentEntry | null) => {
    setSelectedTournamentId(tournament?.id ?? '');
    if (!tournament) {
      setPreviousEdition('');
      return;
    }
    setEventType(tournament.eventType);
    if (tournament.level) changeLevel(tournament.level);
    setTournamentWeek(`${tournament.year}-W${tournament.week.padStart(2, '0')}`);
    setPreviousEdition(previousEditionMatch(tournament, previousEditionOptions)?.id ?? '');
  };

  const resetExample = () => {
    setLevel('super750'); setEventType('individual'); setSelectedTournamentId(''); setTournamentWeek(defaultTournamentWeek); setPreviousEdition(''); setPlayers(initialPlayers); setOutcomeDiscipline('MS'); setShowOutcomeTable(false);
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <h1 className="font-heading text-lg font-semibold tracking-tight sm:text-xl">Badminton World Ranking Points Simulator</h1>
          <Button variant="outline" size="sm" onClick={resetExample}><RotateCcw /> Reset Simulator</Button>
        </div>
      </header>

      <section className="mx-auto max-w-[1440px] px-4 pt-4 pb-7 sm:px-6 lg:px-8 lg:pt-5 lg:pb-9">
        <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <p className="text-sm leading-6 text-muted-foreground">Pick a tournament, select one or more top 100 players or pairs, enter hypothetical results, and preview world ranking points changes.</p>
          <Badge variant="outline" className="h-7 px-3"><CalendarClock /> Latest Reference · {rankingMeta.dateLabel}</Badge>
        </div>

        <div className="mb-3">
          <h2 className="font-heading text-xl font-semibold">PICK A TOURNAMENT</h2>
          <p className="text-[13px] text-muted-foreground">Choose a current or upcoming BWF tournament. Its event type, level, week, and previous edition fill automatically.</p>
        </div>

        <Card className="mb-6 overflow-visible border-l-4 border-l-primary shadow-[0_12px_35px_rgb(22_62_43/6%)]">
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.1fr_.85fr_1.45fr_.75fr_1.45fr]">
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">Tournament Name<CurrentTournamentSearch options={currentTournamentOptions} value={selectedTournamentId} onSelect={selectTournament} /></label>
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">Event Type<NativeSelect className="w-full" value={eventType} onChange={(event) => setEventType(event.target.value as 'individual' | 'team')} aria-label="Event Type"><NativeSelectOption value="individual">Individual Event</NativeSelectOption><NativeSelectOption value="team">Team Event</NativeSelectOption></NativeSelect></label>
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">Tournament Level<NativeSelect className="w-full" value={eventType === 'team' ? '' : level} onChange={(event) => changeLevel(event.target.value as LevelKey)} aria-label="Tournament Level" disabled={eventType === 'team'}>{eventType === 'team' && <NativeSelectOption value="">Not Applicable</NativeSelectOption>}{Object.entries(levels).map(([key, item]) => <NativeSelectOption key={key} value={key}>{item.label}</NativeSelectOption>)}</NativeSelect></label>
            <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">Tournament Week<NativeSelect className="w-full" value={tournamentWeek} onChange={(event) => setTournamentWeek(event.target.value)} aria-label="Tournament Week" aria-invalid={!validTournamentWeek}>{tournamentWeekOptions.map((week) => <NativeSelectOption key={week} value={week}>{week}</NativeSelectOption>)}</NativeSelect></label>
            <div className="grid gap-1.5 text-xs font-medium text-muted-foreground"><span>Previous Edition Replaced</span><TournamentSearch key={previousYear} options={previousEditionOptions} value={selectedPreviousEdition?.id ?? ''} year={previousYear} onSelect={setPreviousEdition} /></div>
            <div className="rounded-lg bg-secondary px-4 py-3 sm:col-span-2 lg:col-span-1"><p className="text-xs text-muted-foreground">Winner Earns</p><p className="mt-1 text-2xl font-semibold tabular-nums">{eventType === 'team' ? 'Manual' : `${fmt(winnerAward)} pts`}</p></div>
          </CardContent>
        </Card>

        {!validTournamentWeek && <Alert variant="destructive" className="mb-5"><CircleHelp /><AlertTitle>Choose a tournament week</AlertTitle><AlertDescription>Select the week in which the tournament is played. Automatic 52-week expiry is paused until the week is valid.</AlertDescription></Alert>}

        <div className="mb-3 flex items-end justify-between gap-4">
          <div><h2 className="font-heading text-xl font-semibold">PICK YOUR PLAYERS &amp; RESULTS</h2><p className="text-[13px] text-muted-foreground">{players.length} {players.length === 1 ? 'player' : 'players'} · results recalculate instantly</p></div>
          <Button className="hidden sm:inline-flex" disabled={players.length >= 10} onClick={addPlayer}><Plus /> Add Player</Button>
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-2">
          {summaries.map(({ player, result }, playerIndex) => {
            const ChangeIcon = result.change > 0 ? ArrowUpRight : result.change < 0 ? ArrowDownRight : ArrowRight;
            const changeTone = result.change > 0 ? 'text-primary' : result.change < 0 ? 'text-destructive' : 'text-muted-foreground';
            const explanation = !result.hasBreakdown
              ? 'BWF does not publish a score breakdown for this ranking entry, so an exact projection is unavailable.'
              : eventType === 'team' && result.award <= 0
              ? 'Enter a projected team-event award.'
              : !result.newCounts
                ? `${fmt(result.award)} awarded · below the current cutoff.`
                : result.dropped.length
                  ? `${fmt(result.award)} enters · ${result.dropped[0].label} (${fmt(result.dropped[0].points)}) leaves the counting ten.`
                  : `${fmt(result.award)} enters the ranking total.`;
            return (
              <Card key={player.id} className="shadow-[0_12px_35px_rgb(22_62_43/6%)]">
                <CardHeader className="border-b">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid flex-1 gap-3 sm:grid-cols-[1.4fr_.8fr]">
                      <div className="grid gap-1 text-[11px] font-medium text-muted-foreground"><span>Player / Pair</span>
                        <PlayerSearch
                          player={player}
                          index={playerIndex}
                          onChange={(name) => patchPlayer(player.id, { name, discipline: '', rankingKey: undefined, snapshotPoints: undefined, snapshotRank: undefined, snapshotTournaments: undefined, sourceHref: undefined, scores: [] })}
                          onSelect={(candidate) => {
                            const automatic = scoresFor(candidate);
                            patchPlayer(player.id, {
                              name: candidate.name,
                              discipline: candidate.discipline,
                              rankingKey: automatic.rankingKey,
                              snapshotPoints: candidate.points,
                              snapshotRank: candidate.rank,
                              snapshotTournaments: candidate.tournaments,
                              sourceHref: candidate.href,
                              scores: automatic.scores,
                            });
                          }}
                        />
                        {player.snapshotRank && <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-normal text-muted-foreground"><span>BWF #{player.snapshotRank} · {fmt(player.snapshotPoints ?? 0)} pts · {player.snapshotTournaments} tournaments</span></span>}
                      </div>
                      <div className="grid gap-1 text-[11px] font-medium text-muted-foreground"><span>Discipline</span><div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm font-medium text-foreground">{player.discipline || '—'}</div></div>
                    </div>
                    <Button variant="ghost" size="icon" aria-label={`Remove ${player.name}`} disabled={players.length === 1} onClick={() => setPlayers((current) => current.filter((item) => item.id !== player.id))}><Trash2 /></Button>
                  </div>
                </CardHeader>
                {player.rankingKey && (
                  <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-[1fr_1.25fr]">
                        {eventType === 'individual' ? (
                          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">Projected Finish<NativeSelect className="w-full" value={player.result} onChange={(event) => patchPlayer(player.id, { result: event.target.value as RoundKey })} aria-label={`${player.name} projected finish`}>{roundsFor(level).map((round) => <NativeSelectOption key={round} value={round}>{roundLabels[round]}</NativeSelectOption>)}</NativeSelect></label>
                        ) : (
                          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground">Projected Team Points Awarded<Input type="number" min="0" value={player.manualTeamAward || ''} onChange={(event) => patchPlayer(player.id, { manualTeamAward: Number(event.target.value) })} aria-label={`${player.name} projected team points awarded`} placeholder="Points" /></label>
                        )}
                        <div className="rounded-xl bg-secondary px-4 py-3">
                          <div className="flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{result.hasBreakdown ? 'Projected Points' : 'Current Points'}</span>{result.hasBreakdown ? <span className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${changeTone}`}><ChangeIcon className="size-3.5" />{result.change > 0 ? '+' : ''}{fmt(result.change)}</span> : <Badge variant="outline">Breakdown Unavailable</Badge>}</div>
                          <div className="mt-1 flex items-baseline gap-2"><span className="text-3xl font-semibold tracking-tight tabular-nums">{fmt(result.after)}</span>{result.hasBreakdown && <span className="text-xs text-muted-foreground">from {fmt(result.before)}</span>}</div>
                          <p className="mt-2 border-t border-border/70 pt-2 text-[11px] leading-4 text-muted-foreground">{explanation}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-lg border bg-card px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Points Awarded</p><p className="mt-0.5 font-semibold tabular-nums">{fmt(result.award)}</p></div>
                        <div className="rounded-lg border bg-card px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Counting Cutoff</p><p className="mt-0.5 font-semibold tabular-nums">{result.hasBreakdown ? fmt(result.cutoff) : '—'}</p></div>
                        <div className="rounded-lg border bg-card px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Expires / Replaced</p><p className="mt-0.5 font-semibold tabular-nums">{result.hasBreakdown ? result.removed.length : '—'}</p></div>
                      </div>

                      {result.hasBreakdown ? (
                        <details className="group rounded-xl border bg-card">
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium marker:hidden"><span>BWF Score Breakdown <span className="font-normal text-muted-foreground">· {result.beforeScores.length} counting now · {player.scores.length} results</span></span><ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" /></summary>
                          <div className="divide-y border-t">
                            {player.scores.map((score) => {
                              const removed = result.removed.some((item) => item.id === score.id);
                              const countsAfter = result.afterScores.some((item) => item.id === score.id);
                              const replaced = isReplacedBy(score, selectedPreviousEdition);
                              return (
                                <div key={score.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[90px_minmax(0,1fr)_70px_auto] sm:items-center">
                                  <span className="text-[11px] tabular-nums text-muted-foreground">{score.week.replace('-W', ' / ')}</span>
                                  <span className="min-w-0"><span className="block truncate text-xs font-medium">{score.label}</span><span className="text-[10px] text-muted-foreground">{score.result}{score.team ? ' · Team Event' : ''}</span></span>
                                  <span className="text-right text-xs font-semibold tabular-nums">{fmt(score.points)}</span>
                                  <span className="flex flex-wrap justify-end gap-1">{score.bwfValid && <Badge variant="secondary">Counting Now</Badge>}{removed && <Badge variant="destructive">{replaced ? 'Replaced' : 'Expires'}</Badge>}{!removed && countsAfter && !score.bwfValid && <Badge>Counts After</Badge>}</span>
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      ) : (
                        <Alert><CircleHelp /><AlertTitle>No Published Breakdown</AlertTitle><AlertDescription>The BWF ranking page currently returns no score breakdown for this entry. Its official current total is shown, but the simulator will not invent an exact projection.</AlertDescription></Alert>
                      )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        <Button className="mt-4 w-full sm:hidden" disabled={players.length >= 10} onClick={addPlayer}><Plus /> Add Player</Button>

        <div className="mb-3 mt-8">
          <h2 className="font-heading text-xl font-semibold">GENERATE TOP 8 SCENARIOS</h2>
        </div>
        <Card>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              <span>Generate a table showing all possible outcomes for the top eight</span>
              <NativeSelect className="w-auto" value={outcomeDiscipline} onChange={(event) => setOutcomeDiscipline(event.target.value as DisciplineCode)} aria-label="Top 8 comparison discipline">
                {disciplineOptions.map((discipline) => <NativeSelectOption key={discipline.code} value={discipline.code}>{discipline.label}</NativeSelectOption>)}
              </NativeSelect>
              <span>players or pairs with a single click.</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={eventType === 'team'} onClick={() => setShowOutcomeTable(true)}><Table2 /> Generate</Button>
              {eventType === 'team' && <span className="text-xs text-muted-foreground">Available for individual events.</span>}
            </div>
            {showOutcomeTable && eventType === 'individual' && (
              <div className="-mx-4 overflow-hidden border-y sm:mx-0 sm:rounded-xl sm:border">
                <div className="border-b bg-muted/35 px-4 py-3">
                  <p className="text-sm font-semibold">TOP 8 RANKING POINTS SCENARIOS · {disciplineOptions.find((discipline) => discipline.code === outcomeDiscipline)?.label}</p>
                  <p className="text-xs text-muted-foreground">Projected total ranking points for each possible tournament finish in {selectedTournament?.name ?? 'the selected tournament'}.</p>
                </div>
                <Table className="w-max min-w-full tabular-nums">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-10 w-32 max-w-32 bg-card">Players/Pairs</TableHead>
                      {outcomeTableRounds.map((round) => <TableHead key={round.key} className="min-w-20 text-right">{round.label}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outcomeRows.map((row) => (
                      <TableRow key={`${row.candidate.code}-${row.candidate.rank}`}>
                        <TableCell className="sticky left-0 z-10 w-32 max-w-32 whitespace-normal bg-card font-medium leading-tight"><span className="mr-1 text-[10px] text-muted-foreground">#{row.candidate.rank}</span>{row.displayName}</TableCell>
                        {row.totals.map((total, index) => <TableCell key={outcomeTableRounds[index].key} className="min-w-20 text-right font-medium">{fmt(total)}</TableCell>)}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <section className="mt-8">
          <Card>
            <CardHeader className="border-b"><CardTitle>What the Simulator Does</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-2 text-sm leading-[1.4] text-muted-foreground">
                <li className="flex gap-3"><Badge>1</Badge><span>Remove results that are at least 52 weeks old and any marked previous edition.</span></li>
                <li className="flex gap-3"><Badge>2</Badge><span>Keep only the best valid team event result.</span></li>
                <li className="flex gap-3"><Badge>3</Badge><span>Add the projected ranking points, then total all results when there are 10 or fewer, or the highest 10 when there are 11 or more.</span></li>
              </ol>
            </CardContent>
          </Card>
        </section>

        <Alert className="mt-5"><CircleHelp /><AlertTitle>Fan-developed Tool, Not an Official Ranking Publication</AlertTitle><AlertDescription>This tool is provided for entertainment and informational purposes only. Calculations are unofficial and may contain errors. The developer is not responsible for any decisions made or losses incurred based on the results shown here.</AlertDescription></Alert>
      </section>
    </main>
  );
}
