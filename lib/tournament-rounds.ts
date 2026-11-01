export function super1000HasRound64(level: string, year: number): boolean {
  return year >= 2027 && (level === 'super1000' || level === 'chinaOpen');
}
