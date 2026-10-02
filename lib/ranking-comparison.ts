type RankingReference = { discipline: string; name: string; rank: number; points: number };
type ComparedPlayer = Pick<RankingReference, 'discipline' | 'name'> & {
  snapshotRank?: number;
  snapshotPoints?: number;
};

// This compares projected points with current points; it does not predict the official rank.
export function aboveCurrentRank(
  points: number,
  player: ComparedPlayer,
  references: readonly RankingReference[],
): number | null {
  const overtakenRanks = references
    .filter((candidate) =>
      candidate.discipline === player.discipline
      && candidate.name !== player.name
      && candidate.rank >= 1 && candidate.rank <= 199
      && points > candidate.points)
    .map((candidate) => candidate.rank);

  if (
    player.snapshotRank !== undefined
    && player.snapshotRank >= 1 && player.snapshotRank <= 199
    && player.snapshotPoints !== undefined
    && points > player.snapshotPoints
  ) {
    overtakenRanks.push(player.snapshotRank);
  }

  return overtakenRanks.length ? Math.min(...overtakenRanks) : null;
}
