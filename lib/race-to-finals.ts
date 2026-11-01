export type RaceScore = { label: string; week: string; level: string; points: number };
export type RacePlayer = { code: string; name: string; profile: string; rank: number; points: number; scores: RaceScore[] };
export type RaceData = { season: number; edition: { date: string; week: number | null }; players: RacePlayer[] };

// Tournament results pages list awards, not grades. All five champions must
// receive the same known tour award before the collector accepts a level.
export function levelFromChampionAwards(points: number[]): string | null {
  const levels: Record<number, string> = { 5500: 'super100', 7000: 'super300', 9200: 'super500', 11000: 'super750', 12000: 'super1000', 13500: 'chinaOpen' };
  return points.length === 5 && new Set(points).size === 1 ? levels[points[0]] ?? null : null;
}

export function raceSeasonForWeek(week: string): number {
  const match = /^(20\d{2})-W(\d{2})$/.exec(week);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 53) return NaN;
  return Number(match[1]) + (Number(match[2]) >= 48 ? 1 : 0);
}

export function raceTotal(scores: readonly RaceScore[], season = 2026): number {
  const eligible = scores.filter(score => raceSeasonForWeek(score.week) === season
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
  const season = raceSeasonForWeek(event.week);
  const before = season === data.season ? player.points : 0;
  if (!Number.isFinite(season) || season < data.season) return { points: null, before, season, note: 'The selected week predates this Race-to-Finals season' };
  if (season === data.season && data.edition.week && event.week < `${data.edition.date.slice(0, 4)}-W${String(data.edition.week).padStart(2, '0')}`) {
    return { points: null, before, season, note: 'The selected week predates this Race-to-Finals reference' };
  }
  if (event.team || !['super100', 'super300', 'super500', 'super750', 'super1000', 'chinaOpen'].includes(event.level)) {
    return { points: before, before, season, note: `This tournament does not award Race-to-Finals points · ${season} season` };
  }
  // A future season starts at zero; only a published snapshot for that season
  // can supply an existing balance. No previous-season results carry over.
  const scores = season === data.season ? player.scores : [];
  const points = raceTotal([...scores, { ...event, label: 'Hypothetical result' }], season);
  return { points, before, season, note: `${season} season · best 14 results · at most three Super 100 results` };
}
