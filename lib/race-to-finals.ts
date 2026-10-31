export type RaceScore = { label: string; week: string; level: string; points: number };
export type RacePlayer = { code: string; name: string; profile: string; rank: number; points: number; scores: RaceScore[] };
export type RaceData = { season: number; edition: { date: string; week: number | null }; players: RacePlayer[] };

// Tournament results pages list awards, not grades. All five champions must
// receive the same known tour award before the collector accepts a level.
export function levelFromChampionAwards(points: number[]): string | null {
  const levels: Record<number, string> = { 5500: 'super100', 7000: 'super300', 9200: 'super500', 11000: 'super750', 12000: 'super1000', 13500: 'chinaOpen' };
  return points.length === 5 && new Set(points).size === 1 ? levels[points[0]] ?? null : null;
}

export function raceTotal(scores: readonly RaceScore[]): number {
  const eligible = scores.filter(score => score.week >= '2025-W48' && score.week <= '2026-W47'
    && ['super100', 'super300', 'super500', 'super750', 'super1000', 'chinaOpen'].includes(score.level));
  const super100 = eligible.filter(score => score.level === 'super100').sort((a, b) => b.points - a.points).slice(0, 3);
  return [...eligible.filter(score => score.level !== 'super100'), ...super100]
    .sort((a, b) => b.points - a.points).slice(0, 14).reduce((sum, score) => sum + score.points, 0);
}

// Match whole name components in any order, including joined/split given names.
function nameParts(name: string): string[][] {
  return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split('/')
    .map(part => part.replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean));
}
function canJoin(parts: string[], target: string): boolean {
  if (!parts.length) return target === '';
  return parts.some((part, i) => target.startsWith(part) && canJoin(parts.filter((_, j) => i !== j), target.slice(part.length)));
}
export function sameRaceName(left: string, right: string): boolean {
  const a = nameParts(left), b = nameParts(right);
  if (a.length !== b.length || a.some(parts => !parts.length)) return false;
  const unused = [...b];
  for (const parts of a) {
    const index = unused.findIndex(other => canJoin(parts, other.join('')) || canJoin(other, parts.join('')));
    if (index < 0) return false;
    unused.splice(index, 1);
  }
  return true;
}

export function findRacePlayer(data: RaceData, player: { name: string; code: string; href?: string }): RacePlayer | undefined {
  const profileId = (href: string) => {
    try { const url = new URL(href); return url.hostname.endsWith('tournamentsoftware.com') ? url.searchParams.get('player') : null; }
    catch { return null; }
  };
  const id = profileId(player.href ?? '');
  const matches = data.players.filter(candidate => candidate.code === player.code && candidate.rank <= 25
    && ((id && profileId(candidate.profile) === id) || sameRaceName(candidate.name, player.name)));
  return matches.length === 1 ? matches[0] : undefined;
}

export function projectRacePoints(data: RaceData, player: RacePlayer, event: { week: string; level: string; points: number; team: boolean }) {
  if (data.season !== 2026 || event.week >= '2026-W50') return { points: null, note: 'The 2026 Race-to-Finals season has ended.' };
  if (!/^20\d{2}-W\d{2}$/.test(event.week) || event.week < '2025-W48') return { points: null, note: 'Outside the 2026 Race-to-Finals season.' };
  if (data.edition.week && event.week < `${data.edition.date.slice(0, 4)}-W${String(data.edition.week).padStart(2, '0')}`) {
    return { points: null, note: 'The selected week predates this Race-to-Finals reference.' };
  }
  if (event.team || !['super100', 'super300', 'super500', 'super750', 'super1000', 'chinaOpen'].includes(event.level)) {
    return { points: player.points, note: 'This tournament does not award Race-to-Finals points.' };
  }
  if (event.week > '2026-W47') return { points: player.points, note: 'This tournament belongs to the 2027 race; the 2026 total is unchanged.' };
  const points = raceTotal([...player.scores, { ...event, label: 'Hypothetical result' }]);
  return { points, note: '2026 season · best 14 results · at most three Super 100 results.' };
}
