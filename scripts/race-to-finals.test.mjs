import test from 'node:test';
import assert from 'node:assert/strict';
import { raceTotal, levelFromChampionAwards, findRacePlayer, projectRacePoints } from '../lib/race-to-finals.ts';

const score = (points, level = 'super500', week = '2026-W20') => ({ label: 'Event', points, level, week });
const player = { code: 'MD', name: 'LEE Jong Min / JIN Yong', profile: 'https://www.tournamentsoftware.com/ranking/player.aspx?id=123&player=456', rank: 12, points: 10000, scores: [score(10000)] };
const data = { season: 2026, edition: { date: '2026-10-27', week: 44 }, players: [player] };
const event = { week: '2026-W45', level: 'super500', points: 9200, team: false };

test('counts all results below 14, and best 14 above it', () => {
  assert.equal(raceTotal([score(1000), score(2000)]), 3000);
  assert.equal(raceTotal(Array.from({ length: 16 }, (_, i) => score((i + 1) * 100))), 13300);
});
test('only best three S100 scores count even below fourteen total results', () => {
  assert.equal(raceTotal([score(9000), ...[100, 200, 300, 400, 500].map(p => score(p, 'super100'))]), 10200);
});
test('S100 cap is applied before the best fourteen selection', () => {
  assert.equal(raceTotal([...Array.from({ length: 14 }, () => score(100)), ...[1000, 2000, 3000, 4000].map(p => score(p, 'super100'))]), 10100);
});
test('season boundaries and eligible event levels are independent of world ranking equivalents', () => {
  assert.equal(raceTotal([score(100, 'super500', '2025-W47'), score(200, 'super500', '2025-W48'), score(400, 'chinaOpen', '2026-W47'), score(800, 'super500', '2026-W48'), score(12000, 'asianChampionships'), score(14000, 'finals')]), 600);
});
test('new S100 result replaces the weakest of three S100 results', () => {
  const p = { ...player, points: 9000, scores: [score(2000, 'super100'), score(3000, 'super100'), score(4000, 'super100')] };
  assert.equal(projectRacePoints(data, p, { ...event, level: 'super100', points: 5500 }).points, 12500);
});
test('no annual edition replacement or 52-week expiry is applied', () => {
  const p = { ...player, points: 1000, scores: [score(1000, 'super500', '2025-W48')] };
  assert.equal(projectRacePoints(data, p, event).points, 10200);
});
test('excluded tournaments and next-season events leave 2026 points unchanged', () => {
  assert.equal(projectRacePoints(data, player, { ...event, level: 'asianGames' }).points, 10000);
  assert.equal(projectRacePoints(data, player, { ...event, team: true }).points, 10000);
  assert.equal(projectRacePoints(data, player, { ...event, week: '2026-W48' }).points, 10000);
  assert.match(projectRacePoints(data, player, { ...event, week: '2026-W48', level: 'asianGames' }).note, /does not award/);
  assert.equal(projectRacePoints(data, player, { ...event, week: '2026-W50' }).points, null);
  assert.equal(projectRacePoints(data, player, { ...event, week: '2026-W43' }).points, null);
});
test('matches identity across rank and edition changes; respects discipline and both partners', () => {
  assert.equal(findRacePlayer(data, { code: 'MD', name: 'JIN Yong / LEE JongMin' }), player);
  assert.equal(findRacePlayer(data, { code: 'MD', name: 'Other spelling', href: player.profile.replace('id=123', 'id=999') }), player);
  assert.equal(findRacePlayer(data, { code: 'XD', name: player.name }), undefined);
  assert.equal(findRacePlayer(data, { code: 'MD', name: 'JIN Yong / LEE Different' }), undefined);
  assert.equal(findRacePlayer({ ...data, players: [{ ...player, rank: 26 }] }, { code: 'MD', name: player.name }), undefined);
  assert.equal(findRacePlayer({ ...data, players: [player, player] }, { code: 'MD', name: player.name }), undefined);
});
test('tournament level requires five agreeing known champion awards', () => {
  assert.equal(levelFromChampionAwards(Array(5).fill(5500)), 'super100');
  assert.equal(levelFromChampionAwards(Array(5).fill(12000)), 'super1000');
  assert.equal(levelFromChampionAwards(Array(5).fill(13500)), 'chinaOpen');
  assert.equal(levelFromChampionAwards(Array(5).fill(14500)), null);
  assert.equal(levelFromChampionAwards([5500, 5500, 5500, 5500, 7000]), null);
  assert.equal(levelFromChampionAwards([5500]), null);
});

test('saved source snapshot contains 25 unique entries per discipline with validated totals', async () => {
  const { readFile } = await import('node:fs/promises');
  const snapshot = JSON.parse(await readFile(new URL('../lib/race-to-finals-data.json', import.meta.url)));
  assert.equal(snapshot.season, 2026);
  assert.match(snapshot.edition.date, /^202[56]-\d{2}-\d{2}$/);
  for (const code of ['MS', 'WS', 'MD', 'WD', 'XD']) {
    const players = snapshot.players.filter(p => p.code === code);
    assert.equal(players.length, 25);
    assert.equal(new Set(players.map(p => new URL(p.profile).searchParams.get('player'))).size, 25);
    for (const p of players) {
      assert.equal(p.name.split('/').length, ['MS', 'WS'].includes(code) ? 1 : 2);
      assert.ok(p.rank >= 1 && p.rank <= 25);
      assert.equal(p.scores.filter(s => s.used).reduce((sum, s) => sum + s.points, 0), p.points, p.name);
      assert.equal(raceTotal(p.scores), p.points, p.name);
    }
  }
});
