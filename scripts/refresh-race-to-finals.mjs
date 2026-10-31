// Adapted from the independent workbook updater; no workbook files are modified.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { writeFile, rename } from 'node:fs/promises';
import { raceTotal, levelFromChampionAwards } from '../lib/race-to-finals.ts';
const rankingUrl = 'https://www.tournamentsoftware.com/ranking/ranking.aspx?rid=211';
const topCount = 25;

const disciplines = [
  { code: 'MS', category: 2805, profileLabel: "Men's Singles" },
  { code: 'WS', category: 2806, profileLabel: "Women's Singles" },
  { code: 'MD', category: 2807, profileLabel: "Men's Doubles" },
  { code: 'WD', category: 2808, profileLabel: "Women's Doubles" },
  { code: 'XD', category: 2809, profileLabel: 'Mixed Doubles' },
];

const countryCodes = new Map(Object.entries({
  'china': 'CHN', 'japan': 'JPN', 'south korea': 'KOR', 'republic of korea': 'KOR',
  'indonesia': 'INA', 'malaysia': 'MAS', 'india': 'IND', 'chinese taipei': 'TPE',
  'taiwan': 'TPE', 'denmark': 'DEN', 'france': 'FRA', 'england': 'ENG',
  'spain': 'ESP', 'bulgaria': 'BUL', 'hong kong': 'HKG', 'singapore': 'SGP',
  'thailand': 'THA', 'canada': 'CAN', 'united states': 'USA', 'united states of america': 'USA',
  'germany': 'GER', 'netherlands': 'NED', 'scotland': 'SCO', 'ireland': 'IRL',
  'switzerland': 'SUI', 'australia': 'AUS', 'new zealand': 'NZL', 'turkey': 'TUR',
  'united arab emirates': 'UAE', 'united arab emirates (uae)': 'UAE', 'egypt': 'EGY',
  'brazil': 'BRA', 'vietnam': 'VIE', 'myanmar': 'MYA', 'sri lanka': 'SRI',
  'south africa': 'RSA', 'ukraine': 'UKR', 'poland': 'POL', 'czechia': 'CZE',
  'czech republic': 'CZE', 'portugal': 'POR', 'sweden': 'SWE', 'norway': 'NOR',
  'austria': 'AUT', 'belgium': 'BEL', 'iceland': 'ISL', 'israel': 'ISR',
}));

function countryCode(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  const code = text.match(/\b[A-Z]{3}\b/)?.[0] || text.match(/\b[A-Z]{2}\b/)?.[0];
  if (code && code.length === 3) return code;
  const canonical = text.toLocaleLowerCase().replace(/[()]/g, '').trim();
  return countryCodes.get(canonical)
    || [...countryCodes].find(([name]) => canonical.includes(name))?.[1]
    || '';
}

function getWeekAndDate(text) {
  const source = String(text ?? '').replace(/\s+/g, ' ');
  const iso = source.match(/(20\d{2})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const date = `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
    return { date, week: isoWeek(date) };
  }
  const local = source.match(/(\d{1,2})\/(\d{1,2})\/(20\d{2})/);
  if (local) {
    const date = `${local[3]}-${local[1].padStart(2, '0')}-${local[2].padStart(2, '0')}`;
    return { date, week: isoWeek(date) };
  }
  const weekMatch = source.match(/(?:week|wk)\s*(\d{1,2})/i);
  return { date: '', week: weekMatch ? Number(weekMatch[1]) : null };
}

function isoWeek(isoDate) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

async function acceptCookies(page) {
  for (const label of ['Accept all', 'Accept']) {
    const button = page.getByRole('button', { name: label, exact: true }).first();
    if (await button.count().catch(() => 0)) {
      await button.click({ timeout: 1500 }).catch(() => {});
      break;
    }
  }
}

async function gotoWithRetry(page, url, description, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      // Tournamentsoftware sometimes leaves subresources open long enough that
      // waiting for DOMContentLoaded times out even though the page is usable.
      await page.goto(url, { waitUntil: 'commit', timeout: 60_000 });
      await page.locator('body').waitFor({ state: 'visible', timeout: 15_000 });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        console.warn(`${description} navigation did not complete (attempt ${attempt}/${attempts}); retrying.`);
        await page.waitForTimeout(1_500 * attempt).catch(() => {});
      }
    }
  }
  const reason = lastError instanceof Error ? lastError.message.split('\n')[0] : String(lastError);
  throw new Error(`Could not open ${description} after ${attempts} attempts: ${reason}`);
}

async function discoverEdition(context) {
  const page = await context.newPage();
  try {
    await gotoWithRetry(page, rankingUrl, 'Race-to-Finals overview');
    await acceptCookies(page);
    await page.locator('a[href*="category.aspx"]').first().waitFor({ state: 'attached', timeout: 30_000 });
    const edition = await page.evaluate(() => {
      const links = [...document.querySelectorAll('a[href*="category.aspx"]')];
      const link = links.find((item) => /category=2805/.test(item.href))
        || links.find((item) => new URL(item.href).searchParams.has('id'));
      const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
        .map((node) => node.textContent?.replace(/\s+/g, ' ').trim() || '');
      const selected = [...document.querySelectorAll('select option:checked')]
        .map((node) => node.textContent?.replace(/\s+/g, ' ').trim() || '').join(' ');
      return {
        href: link?.href || '',
        text: [...headings, selected, document.title].join(' '),
      };
    });
    if (!edition.href) throw new Error('Could not find the current Race-to-Finals category link on the ranking page.');
    const id = new URL(edition.href).searchParams.get('id');
    if (!id) throw new Error(`Could not read the current ranking edition ID from ${edition.href}`);
    const calendar = getWeekAndDate(edition.text);
    return { id, ...calendar };
  } finally {
    await page.close();
  }
}

async function readRankingCategory(context, editionId, discipline) {
  const page = await context.newPage();
  try {
    const url = `https://www.tournamentsoftware.com/ranking/category.aspx?id=${encodeURIComponent(editionId)}&category=${discipline.category}`;
    await gotoWithRetry(page, url, `${discipline.code} ranking page`);
    await acceptCookies(page);
    await page.locator('table:visible tbody tr:visible a[href*="player.aspx"]')
      .first()
      .waitFor({ state: 'visible', timeout: 45_000 });

    const rankingRows = await page.locator('table:visible tbody tr:visible').evaluateAll((rows, limit) => rows.map((row) => {
      const cells = [...row.querySelectorAll('td')];
      const links = [...row.querySelectorAll('a[href*="player.aspx"]')]
        .filter((link) => new URL(link.href).pathname === '/ranking/player.aspx');
      if (!links.length) return null;
      const rank = Number((cells[0]?.textContent?.match(/\d+/) || [])[0]);
      const points = Number((cells.at(-1)?.textContent || '').replace(/[^\d.-]/g, ''));
      const country = cells
        .map((cell) => cell.innerText?.replace(/\s+/g, ' ').trim() || '')
        .map((text) => text.match(/\b[A-Z]{3}\b/)?.[0] || '')
        .find(Boolean) || '';
      return {
        rank,
        name: links.map((link) => link.textContent?.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' / '),
        profile: links[0]?.href || '',
        country,
        points,
      };
    }).filter(Boolean).slice(0, limit), topCount);

    if (rankingRows.length !== topCount) {
      throw new Error(`${discipline.code}: expected ${topCount} players/pairs from the current category, got ${rankingRows.length}.`);
    }
    for (const player of rankingRows) {
      if (!Number.isInteger(player.rank) || player.rank < 1 || player.rank > 25 || !Number.isFinite(player.points) || player.points <= 0 || !player.name || !player.profile) {
        throw new Error(`${discipline.code}: incomplete ranking row at rank ${player.rank || '?'} (name=${player.name || 'missing'}, points=${Number.isFinite(player.points) ? player.points : 'missing'}, profile=${player.profile || 'missing'}); refusing to publish a partial workbook.`);
      }
      if (player.name.split('/').length !== (['MS', 'WS'].includes(discipline.code) ? 1 : 2)) throw new Error(`${discipline.code}: incomplete player/pair identity`);
      player.country = countryCode(player.country) || countryCode(await readCountryFromProfile(context, player.profile));
      if (!player.country) throw new Error(`${discipline.code} rank ${player.rank}: could not determine country code for ${player.name}.`);
    }
    return rankingRows;
  } finally {
    await page.close();
  }
}

async function readCountryFromProfile(context, profileUrl) {
  const page = await context.newPage();
  try {
    await gotoWithRetry(page, profileUrl, 'player profile');
    const country = await page.locator('img[alt],img[title],.country_code').evaluateAll((images) => images
      .map((image) => image.getAttribute('alt') || image.getAttribute('title') || image.textContent || '')
      .find(Boolean) || '');
    return country;
  } finally {
    await page.close();
  }
}

async function readBreakdown(context, player, discipline) {
  const page = await context.newPage();
  try {
    await gotoWithRetry(page, player.profile, `${discipline.code} results breakdown`);
    await acceptCookies(page);
    await page.locator('table caption').filter({ hasText: 'results of' }).first()
      .waitFor({ state: 'visible', timeout: 30_000 });
    const scores = await page.locator('table').evaluateAll((tables, args) => {
      const normalizeName = (value) => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase().replace(/[^a-z0-9/]+/g, ' ').trim()
        .split('/').map((part) => part.trim().split(/\s+/).filter(Boolean).sort().join(' ')).filter(Boolean).sort().join(' / ');
      const expected = normalizeName(args.name);
      const table = tables.find((candidate) => {
        const caption = candidate.querySelector('caption')?.textContent?.replace(/\s+/g, ' ').trim() || '';
        const prefix = `${args.label} results of `;
        return caption.startsWith(prefix) && normalizeName(caption.slice(prefix.length)) === expected;
      });
      if (!table) return null;
      return [...table.querySelectorAll('tbody tr')].map((row) => {
        const cells = [...row.querySelectorAll('td')];
        const tournament = cells[0]?.querySelector('a[href*="tournament.aspx"]');
        if (!tournament) return null;
        const week = (cells[2]?.textContent || '').trim();
        const weekMatch = /^(20\d{2})-(\d{1,2})$/.exec(week);
        return {
          label: tournament.textContent?.replace(/\s+/g, ' ').trim() || '',
          week: weekMatch ? `${weekMatch[1]}-W${weekMatch[2].padStart(2, '0')}` : week,
          tournamentUrl: tournament.href,
          result: cells[3]?.textContent?.replace(/\s+/g, ' ').trim() || '',
          points: Number((cells[4]?.textContent || '').replace(/,/g, '').trim()),
          used: Boolean(row.querySelector('img[alt^="Used for:"]')),
        };
      }).filter(Boolean);
    }, { name: player.name, label: discipline.profileLabel });

    if (!scores) throw new Error(`${discipline.code} rank ${player.rank}: results breakdown was not found for ${player.name}.`);
    const scoreTotal = scores.filter((score) => score.used).reduce((sum, score) => sum + score.points, 0);
    if (Math.round(scoreTotal) !== Math.round(player.points)) {
      throw new Error(`${discipline.code} rank ${player.rank}: used breakdown points (${scoreTotal}) do not match ranking points (${player.points}) for ${player.name}.`);
    }
    return scores;
  } finally {
    await page.close();
  }
}


const tournamentLevels = new Map();
async function tournamentLevel(context, url) {
  if (tournamentLevels.has(url)) return tournamentLevels.get(url);
  const page = await context.newPage();
  try {
    await gotoWithRetry(page, url, 'Race-to-Finals tournament level');
    await acceptCookies(page);
    // Ranking tournament pages omit the grade. Their champion awards identify it
    // unambiguously in the user-supplied eligible-tour points table. Require all
    // five disciplines to agree, rather than guessing from a player's finish.
    await page.locator('table tbody tr').first().waitFor({ state: 'attached' });
    const winnerPoints = await page.locator('table tbody tr').evaluateAll(rows => rows.flatMap(row => {
      const cells = [...row.querySelectorAll('td')];
      return cells[3]?.textContent?.trim() === '1'
        ? [Number(cells[4]?.textContent?.replace(/[^\d.]/g, ''))] : [];
    }));
    const level = levelFromChampionAwards(winnerPoints);
    if (!level) throw new Error(`Unverified tournament level: ${url} (${winnerPoints})`);
    tournamentLevels.set(url, level);
    return level;
  } finally { await page.close(); }
}

export async function refreshRaceToFinals(context) {
  const edition = await discoverEdition(context);
  if (!edition.date || edition.date < '2025-11-24' || edition.date >= '2026-12-14') {
    throw new Error('Race-to-Finals source is not a verified 2026-season publication; preserving the saved dataset.');
  }
  tournamentLevels.clear();
  const players = [];
  for (const discipline of disciplines) {
    const rows = await readRankingCategory(context, edition.id, discipline);
    if (new Set(rows.map(row => new URL(row.profile).searchParams.get('player'))).size !== topCount) {
      throw new Error(`${discipline.code}: duplicate ranking identities`);
    }
    for (const player of rows) {
      const scores = await readBreakdown(context, player, discipline);
      for (const score of scores) {
        score.level = await tournamentLevel(context, score.tournamentUrl);
        if (!score.label || !Number.isFinite(score.points) || !score.level || !/^20\d{2}-W\d{2}$/.test(score.week) || score.week < '2025-W48' || score.week > '2026-W47' || score.points < 0) {
          throw new Error(`${player.name}: invalid season or unrecognised tournament level: ${JSON.stringify(score)}`);
        }
      }
      if (raceTotal(scores) !== player.points) throw new Error(`${player.name}: best-14 / three-S100 total does not match published total`);
      players.push({ ...player, code: discipline.code, scores });
    }
    console.log(`${discipline.code}: validated ${rows.length} Race-to-Finals entries`);
  }
  const data = { season: 2026, edition, generatedAt: new Date().toISOString(), players };
  const destination = new URL('../lib/race-to-finals-data.json', import.meta.url);
  const temporary = new URL('../lib/race-to-finals-data.json.tmp', import.meta.url);
  await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`);
  await rename(temporary, destination);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ locale: 'en-GB', userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' });
    await refreshRaceToFinals(context);
  } finally {
    await browser.close();
  }
}
