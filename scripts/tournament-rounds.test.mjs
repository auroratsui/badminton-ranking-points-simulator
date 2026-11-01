import test from 'node:test';
import assert from 'node:assert/strict';
import { super1000HasRound64 } from '../lib/tournament-rounds.ts';

test('S1000 R64 begins in 2027 for both China Open and other S1000 events', () => {
  for (const level of ['chinaOpen', 'super1000']) {
    assert.equal(super1000HasRound64(level, 2026), false);
    assert.equal(super1000HasRound64(level, 2027), true);
    assert.equal(super1000HasRound64(level, 2028), true);
  }
  assert.equal(super1000HasRound64('super750', 2027), false);
  assert.equal(super1000HasRound64('asianChampionships', 2027), false);
});
