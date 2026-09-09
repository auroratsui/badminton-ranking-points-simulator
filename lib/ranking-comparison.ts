type RankingReference = { discipline: string; name: string; rank: number; points: number };

// This is a comparison with current opponents, not a prediction of the official rank.
export function aboveCurrentRank(
  points: number,
  player: Pick<RankingReference, 'discipline' | 'name'>,
  references: readonly RankingReference[],
): number | null {
  const overtaken = references.filter((candidate) =>
    candidate.discipline === player.discipline
    && candidate.name !== player.name
    && candidate.rank >= 1 && candidate.rank <= 199
    && points > candidate.points);
  return overtaken.length ? Math.min(...overtaken.map((candidate) => candidate.rank)) : null;
}
