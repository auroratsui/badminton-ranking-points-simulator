import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateTournamentSequence } from '../lib/crystal-ball.ts';

const score = (id, points, week = '2026-W20', extra = {}) => ({ id, label: id, points, week, team: false, bwfValid: true, ...extra });
const event = (id, week, points, replaced = [], extra = {}) => ({ id, week, score: score(id, points, week, { bwfValid: false, ...extra }), replaces: (item) => replaced.includes(item.id) });

test('W42/W45/W46 removes all expired and replaced scores and is independent of input order', () => {
  const scores = [score('old-A', 7000, '2025-W48'), score('expires', 4000, '2025-W44'), score('stays', 5000)];
  const events = [event('A', '2026-W42', 3000, ['old-A']), event('B', '2026-W45', 2000), event('C', '2026-W46', 1000)];
  const result = simulateTournamentSequence(scores, events, 16000);
  assert.equal(result.after, 11000);
  assert.equal(result.change, -5000);
  assert.equal(result.finalWeek, '2026-W46');
  assert.equal(result.removed.get('old-A'), 'Replaced');
  assert.equal(result.removed.get('expires'), 'Expired');
  assert.deepEqual(simulateTournamentSequence(scores, [...events].reverse(), 16000), result);
});

test('a previously non-counting result can re-enter after a later expiry', () => {
  const scores = Array.from({ length: 11 }, (_, i) => score(`old-${i}`, 1100 - i * 100, i === 0 ? '2025-W44' : '2026-W20', { bwfValid: i < 10 }));
  const result = simulateTournamentSequence(scores, [event('early', '2026-W42', 50), event('late', '2026-W46', 50)], 6500);
  assert.equal(result.after, 5500);
  assert.equal(result.afterScores.length, 10);
  assert.ok(result.afterScores.some((item) => item.id === 'old-10'));
});

test('only the best team score counts and newer equal scores are prioritised', () => {
  const result = simulateTournamentSequence([score('team-old', 6000, '2026-W20', { team: true }), score('individual', 3000)], [event('team-new', '2026-W42', 6000, [], { team: true }), event('team-low', '2026-W45', 5000, [], { team: true })], 9000);
  assert.equal(result.after, 9000);
  assert.deepEqual(result.afterScores.filter((item) => item.team).map((item) => item.id), ['team-new']);
});

test('a later edition can replace an earlier hypothetical score', () => {
  const result = simulateTournamentSequence([], [event('first', '2026-W42', 5000), event('second', '2027-W30', 3000, ['first'])], 0);
  assert.equal(result.after, 3000);
  assert.equal(result.removed.get('first'), 'Replaced');
});

test('expiry is exactly 52 weeks, including across a 53-week ISO year', () => {
  assert.equal(simulateTournamentSequence([score('boundary', 1000, '2026-W01')], [event('end', '2026-W52', 0)], 1000).after, 1000);
  assert.equal(simulateTournamentSequence([score('boundary', 1000, '2026-W01')], [event('end', '2026-W53', 0)], 1000).after, 0);
  assert.equal(simulateTournamentSequence([score('boundary', 1000, '2026-W02')], [event('end', '2027-W01', 0)], 1000).after, 0);
});

test('current published total stays anchored when the model has an existing discrepancy', () => {
  const result = simulateTournamentSequence([score('old', 4000)], [event('new', '2026-W42', 2000)], 3900);
  assert.equal(result.after, 5900);
});

test('no participation still retires the marked previous edition', () => {
  const result = simulateTournamentSequence([score('old', 4000)], [event('new', '2026-W42', 0, ['old'])], 4000);
  assert.equal(result.after, 0);
  assert.equal(result.afterScores.length, 0);
});
