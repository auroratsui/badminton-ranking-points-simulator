export type ScenarioScore = {
  id: string;
  label: string;
  week: string;
  points: number;
  team: boolean;
  bwfValid: boolean;
};

export type ScenarioEvent = {
  id: string;
  week: string;
  notParticipating?: boolean;
  score: ScenarioScore;
  replaces: (score: ScenarioScore) => boolean;
};

export function conflictingTournamentIds(
  tournaments: readonly { id: string; week: string }[],
  results: Record<string, { round?: string }>,
) {
  const byWeek = new Map<string, string[]>();
  for (const tournament of tournaments) {
    if (results[tournament.id]?.round === 'notEntered') continue;
    const ids = byWeek.get(tournament.week) ?? [];
    ids.push(tournament.id);
    byWeek.set(tournament.week, ids);
  }
  return new Set([...byWeek.values()].filter((ids) => ids.length > 1).flat());
}

function weekTime(week: string) {
  const [year, number] = week.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  return jan4.getTime() + ((number - 1) * 7 - (jan4.getUTCDay() + 6) % 7) * 86400000;
}

function counting(scores: ScenarioScore[], preserveCurrent = false) {
  const compare = (a: ScenarioScore, b: ScenarioScore) => b.points - a.points
    || (preserveCurrent ? Number(b.bwfValid) - Number(a.bwfValid) : 0)
    || b.week.localeCompare(a.week) || a.id.localeCompare(b.id);
  const positive = scores.filter((score) => score.points > 0);
  const bestTeam = positive.filter((score) => score.team).sort(compare)[0];
  return [...positive.filter((score) => !score.team), ...(bestTeam ? [bestTeam] : [])].sort(compare).slice(0, 10);
}

// Keep the entire eligible pool between events: a result outside the top ten can
// re-enter when a higher result expires later in the sequence.
export function simulateTournamentSequence(scores: ScenarioScore[], events: ScenarioEvent[], currentPoints: number) {
  const ordered = [...events].sort((a, b) => a.week.localeCompare(b.week) || a.id.localeCompare(b.id));
  const removed = new Map<string, 'Expired' | 'Replaced'>();
  let pool = [...scores];
  for (const event of ordered) {
    pool = pool.filter((score) => {
      const reason = event.replaces(score) ? 'Replaced'
        : weekTime(event.week) - weekTime(score.week) >= 52 * 604800000 ? 'Expired' : null;
      if (reason) removed.set(score.id, reason);
      return !reason;
    });
    if (event.score.points > 0) pool.push(event.score);
  }
  const afterScores = counting(pool);
  const modeledBefore = counting(scores, true).reduce((sum, score) => sum + score.points, 0);
  const modeledAfter = afterScores.reduce((sum, score) => sum + score.points, 0);
  const after = currentPoints + modeledAfter - modeledBefore;
  return {
    after, change: after - currentPoints, afterScores, removed,
    finalWeek: ordered.at(-1)?.week ?? '',
    allScores: [...scores, ...ordered.filter((event) => !event.notParticipating).map((event) => event.score)],
  };
}
