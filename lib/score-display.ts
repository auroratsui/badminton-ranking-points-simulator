export function newestScoresFirst<T extends { week: string; id: string }>(scores: readonly T[]): T[] {
  return [...scores].sort((a, b) => b.week.localeCompare(a.week)
    || Number(b.id.startsWith('projected-')) - Number(a.id.startsWith('projected-')));
}

export function countingLabel(currentlyCounting: boolean, countsAfter: boolean, projectionReady = true) {
  if (!projectionReady) return currentlyCounting ? 'Counting' : null;
  if (countsAfter) return currentlyCounting ? 'Counting' : 'Counts After';
  return currentlyCounting ? 'Leaves Counting 10' : null;
}
