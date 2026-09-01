import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const rankingUrl = 'https://bwfbadminton.com/rankings/';
const calendarUrl = (year, status = 'all') => `https://corporate.bwfbadminton.com/events/calendar/${year}/${status}/0/-1/`;
const tournamentsoftwareRankingUrl = 'https://www.tournamentsoftware.com/ranking/ranking.aspx?rid=70';
const disciplines = [
  { code: 'MS', discipline: 'Men’s Singles', tournamentsoftwareDiscipline: "Men's Singles", tab: "MEN'S SINGLES", category: 472 },
  { code: 'WS', discipline: 'Women’s Singles', tournamentsoftwareDiscipline: "Women's Singles", tab: "WOMEN'S SINGLES", category: 473 },
  { code: 'MD', discipline: 'Men’s Doubles', tournamentsoftwareDiscipline: "Men's Doubles", tab: "MEN'S DOUBLES", category: 474 },
  { code: 'WD', discipline: 'Women’s Doubles', tournamentsoftwareDiscipline: "Women's Doubles", tab: "WOMEN'S DOUBLES", category: 475 },
  { code: 'XD', discipline: 'Mixed Doubles', tournamentsoftwareDiscipline: 'Mixed Doubles', tab: "MIXED DOUBLES", category: 476 },
];

function normalizedRankingName(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9/]+/g, ' ')
    .trim()
    .split('/')
    .map((part) => part.trim().replace(/\s+/g, ' '))
    .filter(Boolean)
    .sort()
    .join(' / ');
}

function tournamentsoftwareDateToIso(value) {
  const match = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(value);
  return match ? `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}` : '';
}

async function acceptTournamentsoftwareCookies(page) {
  const accept = page.getByRole('button', { name: 'Accept', exact: true });
  if (await accept.count()) {
    await accept.click();
    await page.waitForLoadState('domcontentloaded');
  }
}

async function dismissBwfCookieBanner(page) {
  await page.addStyleTag({
    content: '#cookiescript_injected_wrapper { display: none !important; pointer-events: none !important; }',
  });
  const outcome = await page.evaluate(() => {
    const cookieScript = window.CookieScript?.instance;
    if (typeof cookieScript?.rejectAllAction === 'function') {
      cookieScript.rejectAllAction();
      return 'rejected';
    }
    const wrapper = document.querySelector('#cookiescript_injected_wrapper');
    wrapper?.remove();
    return wrapper ? 'removed' : '';
  });
  if (outcome) console.log(`Dismissed BWF cookie consent overlay (${outcome})`);
}

async function closeRankingBreakdownDialog(page, dialog, rankingKey) {
  const isVisible = () => dialog.isVisible().catch(() => false);
  if (!(await isVisible())) return;

  const closeButtons = [
    dialog.locator('button:has(.mdi-close)').first(),
    dialog.getByRole('button', { name: /^Close$/i }).first(),
  ];

  for (const closeButton of closeButtons) {
    if (!(await isVisible())) return;
    if ((await closeButton.count()) && (await closeButton.isVisible().catch(() => false))) {
      await closeButton.click({ force: true, timeout: 5_000 }).catch(() => {});
      await dialog.waitFor({ state: 'hidden', timeout: 2_000 }).catch(() => {});
    }
  }

  if (await isVisible()) {
    await page.keyboard.press('Escape').catch(() => {});
    await dialog.waitFor({ state: 'hidden', timeout: 2_000 }).catch(() => {});
  }

  if (await isVisible()) throw new Error(`${rankingKey}: ranking breakdown dialog could not be closed`);
}

async function openRankingBreakdownDialog(page, row, rankingKey) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const dialog = page.locator('.v-dialog--active').last();
    if (await dialog.isVisible().catch(() => false)) return dialog;

    const breakdownButton = row.locator('button').first();
    await breakdownButton.scrollIntoViewIfNeeded().catch(() => {});
    await breakdownButton.click({ force: attempt > 1, timeout: 10_000 }).catch(() => {});

    const opened = await dialog.waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    if (opened) return dialog;
    await page.waitForTimeout(500 * attempt);
  }

  const lateDialog = page.locator('.v-dialog--active').last();
  if (await lateDialog.isVisible().catch(() => false)) return lateDialog;

  console.warn(`${rankingKey}: BWF breakdown dialog did not open; Tournamentsoftware fallback will be attempted`);
  return null;
}

async function loadHundredRankingRows(page, rankingTable) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (attempt > 1) {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 });
      await rankingTable.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 60_000 });
    }

    await dismissBwfCookieBanner(page);
    await page.getByRole('button', { name: /Per page/ }).click({ force: attempt > 1 });
    await page.getByRole('option', { name: '100', exact: true }).click({ force: attempt > 1 });

    const loaded = await page.waitForFunction(
      () => document.querySelectorAll('table tbody tr').length >= 100,
      undefined,
      { timeout: 60_000 },
    ).then(() => true).catch(() => false);
    if (loaded) return;
    console.warn(`BWF 100-row view did not load (attempt ${attempt} of 3)`);
  }

  throw new Error('BWF rankings did not load 100 rows after three attempts');
}

async function selectRankingDiscipline(page, rankingTable, config) {
  const firstPlayerLink = rankingTable.locator('tbody tr').first().locator('td').nth(1).locator('a').first();
  const previousFirstPlayerHref = await firstPlayerLink.getAttribute('href');

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const currentFirstPlayerHref = await firstPlayerLink.getAttribute('href').catch(() => null);
    const currentRowCount = await rankingTable.locator('tbody tr').count();
    if (currentRowCount >= 100 && currentFirstPlayerHref && currentFirstPlayerHref !== previousFirstPlayerHref) return;

    await page.getByRole('link', { name: config.tab, exact: true }).click({ force: attempt > 1 });
    const switched = await page.waitForFunction((previousHref) => {
      const rows = document.querySelectorAll('table tbody tr');
      const firstHref = rows[0]?.querySelector('td:nth-child(2) a')?.href;
      return rows.length >= 100 && Boolean(firstHref) && firstHref !== previousHref;
    }, previousFirstPlayerHref, { timeout: 60_000 }).then(() => true).catch(() => false);
    if (switched) return;
    console.warn(`${config.code}: ranking table did not switch disciplines (attempt ${attempt} of 3)`);
  }

  throw new Error(`${config.code}: ranking table did not switch after three attempts`);
}

async function fillMissingBreakdownsFromTournamentsoftware(context, rankingDate, rankingPlayers, rankingBreakdowns) {
  const missingPlayers = rankingPlayers.filter((player) => {
    const scores = rankingBreakdowns[`${player.code}-${player.rank}`]?.scores ?? [];
    const usableScores = scores.filter((score) => score.points > 0 && score.week && score.label);
    const validTotal = usableScores.filter((score) => score.valid).reduce((total, score) => total + score.points, 0);
    return !usableScores.length || Math.round(validTotal) !== player.points;
  });
  if (!missingPlayers.length) return;

  const rankingPage = await context.newPage();
  await rankingPage.goto(tournamentsoftwareRankingUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await acceptTournamentsoftwareCookies(rankingPage);

  const heading = await rankingPage.getByRole('heading', { name: /BWF World Rankings/ }).first().innerText();
  const fallbackDate = tournamentsoftwareDateToIso(heading);
  if (fallbackDate !== rankingDate) {
    console.warn(`Tournamentsoftware fallback skipped: latest edition is ${fallbackDate || 'unknown'}, expected ${rankingDate}`);
    await rankingPage.close();
    return;
  }

  const categoryHref = await rankingPage.locator('a[href*="category.aspx?id="]').first().getAttribute('href');
  const rankingId = categoryHref ? new URL(categoryHref, rankingPage.url()).searchParams.get('id') : null;
  await rankingPage.close();
  if (!rankingId) {
    console.warn('Tournamentsoftware fallback skipped: latest ranking ID was not found');
    return;
  }

  const categoryPage = await context.newPage();
  const breakdownPage = await context.newPage();

  for (const config of disciplines) {
    const missingInDiscipline = missingPlayers.filter((player) => player.code === config.code);
    if (!missingInDiscipline.length) continue;

    const categoryUrl = `https://www.tournamentsoftware.com/ranking/category.aspx?id=${rankingId}&category=${config.category}&p=1&ps=100`;
    await categoryPage.goto(categoryUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await acceptTournamentsoftwareCookies(categoryPage);

    const fallbackEntries = await categoryPage.locator('table tbody tr').evaluateAll((rows) => rows.map((row) => {
      const links = Array.from(row.querySelectorAll('a[href*="player.aspx"]'));
      if (!links.length) return null;
      return {
        name: links.map((link) => link.textContent?.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' / '),
        href: links[0].href,
      };
    }).filter(Boolean));
    const fallbackByName = new Map(fallbackEntries.map((entry) => [normalizedRankingName(entry.name), entry]));

    for (const player of missingInDiscipline) {
      const rankingKey = `${player.code}-${player.rank}`;
      const fallback = fallbackByName.get(normalizedRankingName(player.name));
      if (!fallback) {
        console.warn(`${rankingKey}: no matching Tournamentsoftware player entry for ${player.name}`);
        continue;
      }

      await breakdownPage.goto(fallback.href, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      const scores = await breakdownPage.locator('table').evaluateAll((tables, args) => {
        const normalize = (value) => value
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLocaleLowerCase()
          .replace(/[^a-z0-9/]+/g, ' ')
          .trim()
          .split('/')
          .map((part) => part.trim().replace(/\s+/g, ' '))
          .filter(Boolean)
          .sort()
          .join(' / ');
        const prefix = `${args.discipline} results of `;
        const table = tables.find((candidate) => {
          const caption = candidate.querySelector('caption')?.textContent?.replace(/\s+/g, ' ').trim() || '';
          return caption.startsWith(prefix) && normalize(caption.slice(prefix.length)) === normalize(args.playerName);
        });
        if (!table) return [];

        return Array.from(table.querySelectorAll('tbody tr')).map((row) => {
          const cells = Array.from(row.querySelectorAll('td'));
          const tournamentLink = cells[0]?.querySelector('a[href*="tournament.aspx"]');
          if (!tournamentLink) return null;
          const weekMatch = /^(\d{4})-(\d{1,2})$/.exec(cells[2]?.textContent?.trim() || '');
          return {
            week: weekMatch ? `${weekMatch[1]}-W${weekMatch[2].padStart(2, '0')}` : '',
            label: tournamentLink.textContent?.replace(/\s+/g, ' ').trim() || '',
            href: tournamentLink.href,
            result: cells[3]?.textContent?.trim() || '',
            points: Number(cells[4]?.textContent?.replace(/,/g, '').trim()),
            valid: Boolean(row.querySelector('img[alt^="Used for:"]')),
          };
        }).filter((score) => score?.week && score.label && Number.isFinite(score.points));
      }, { discipline: config.tournamentsoftwareDiscipline, playerName: player.name });

      const validTotal = scores.filter((score) => score.valid).reduce((total, score) => total + score.points, 0);
      if (!scores.length || Math.round(validTotal) !== player.points) {
        console.warn(`${rankingKey}: Tournamentsoftware fallback rejected (valid total ${validTotal}, expected ${player.points})`);
        continue;
      }

      const current = rankingBreakdowns[rankingKey];
      rankingBreakdowns[rankingKey] = {
        ...current,
        name: player.name,
        profiles: Array.from(new Set([...(current?.profiles ?? []), fallback.href])),
        scores,
      };
      console.log(`${rankingKey}: filled missing breakdown from Tournamentsoftware`);
    }
  }

  await categoryPage.close();
  await breakdownPage.close();
}

const browser = await chromium.launch({
  headless: true,
  args: ['--disable-blink-features=AutomationControlled'],
});
const context = await browser.newContext({
  locale: 'en-GB',
  ignoreHTTPSErrors: true,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
});

try {
  const page = await context.newPage();
  await page.goto(rankingUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const rankingTable = page.locator('table').first();
  await rankingTable.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 60_000 });
  await loadHundredRankingRows(page, rankingTable);

  const weekText = await page.getByRole('button', { name: /Week Week/ }).innerText();
  const weekMatch = /Week\s+(\d+)\s+\((\d{4}-\d{2}-\d{2})\)/.exec(weekText.replace(/\s+/g, ' '));
  if (!weekMatch) throw new Error(`Could not read ranking week from: ${weekText}`);

  const rankingPlayers = [];
  const rankingBreakdowns = {};
  let consecutiveDialogFailures = 0;
  let useTournamentsoftwareForRemaining = false;

  for (let disciplineIndex = 0; disciplineIndex < disciplines.length; disciplineIndex += 1) {
    const config = disciplines[disciplineIndex];
    if (disciplineIndex > 0) {
      await selectRankingDiscipline(page, rankingTable, config);
    }

    const rows = rankingTable.locator('tbody tr');
    const players = await rows.evaluateAll((elements) => elements.slice(0, 100).map((row) => {
      const cells = Array.from(row.querySelectorAll('td'));
      const link = cells[1]?.querySelector('a');
      return {
        rank: Number(cells[0]?.querySelector('.rank-value')?.textContent?.trim()),
        name: link?.textContent?.replace(/\s+/g, ' ').trim() || '',
        href: link?.href || '',
        tournaments: Number(cells[3]?.textContent?.replace(/,/g, '').trim()),
        points: Number(cells[4]?.textContent?.replace(/,/g, '').trim()),
      };
    }));

    if (players.length !== 100) throw new Error(`${config.code}: expected 100 ranking rows, found ${players.length}`);

    for (let index = 0; index < players.length; index += 1) {
      const player = players[index];
      const rankingKey = `${config.code}-${player.rank}`;
      rankingPlayers.push({ ...player, code: config.code, discipline: config.discipline });

      const row = rows.nth(index);
      const dialog = useTournamentsoftwareForRemaining ? null : await openRankingBreakdownDialog(page, row, rankingKey);
      let scores = [];

      if (dialog) {
        consecutiveDialogFailures = 0;
        await page.waitForTimeout(120);
        scores = await dialog.locator('table tbody tr').evaluateAll((scoreRows) => scoreRows.map((scoreRow) => {
          const cells = Array.from(scoreRow.querySelectorAll('td'));
          const weekParts = (cells[1]?.textContent || '').trim().split('/').map((part) => part.trim());
          const link = cells[2]?.querySelector('a');
          return {
            week: weekParts.length === 2 ? `${weekParts[0]}-W${weekParts[1].padStart(2, '0')}` : '',
            label: link?.textContent?.replace(/\s+/g, ' ').trim() || cells[2]?.textContent?.replace(/\s+/g, ' ').trim() || '',
            href: link?.href || '',
            result: cells[3]?.textContent?.trim() || '',
            points: Number(cells[4]?.textContent?.replace(/,/g, '').trim()),
            valid: Boolean(cells[0]?.querySelector('img')),
          };
        }));
        await closeRankingBreakdownDialog(page, dialog, rankingKey);
      } else {
        consecutiveDialogFailures += 1;
        if (consecutiveDialogFailures >= 3 && !useTournamentsoftwareForRemaining) {
          useTournamentsoftwareForRemaining = true;
          console.warn('BWF breakdown dialogs stopped responding; using Tournamentsoftware for the remaining breakdowns');
        }
      }

      rankingBreakdowns[rankingKey] = { name: player.name, profiles: [player.href], scores };
    }

    console.log(`${config.code}: refreshed 100 entries`);
  }

  await fillMissingBreakdownsFromTournamentsoftware(context, weekMatch[2], rankingPlayers, rankingBreakdowns);

  const generatedAt = new Date().toISOString();
  const rankingMeta = {
    week: Number(weekMatch[1]),
    date: weekMatch[2],
    dateLabel: new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${weekMatch[2]}T00:00:00Z`)),
    generatedAt,
  };
  const rankingSource = `export type RankingPlayer = {\n  code: string;\n  discipline: string;\n  rank: number;\n  name: string;\n  href: string;\n  tournaments: number;\n  points: number;\n};\n\nexport const rankingMeta = ${JSON.stringify(rankingMeta, null, 2)} as const;\n\nexport const rankingPlayers: RankingPlayer[] = ${JSON.stringify(rankingPlayers, null, 2)};\n`;
  await writeFile('lib/ranking-data.ts', rankingSource);
  await writeFile('lib/ranking-breakdowns.json', `${JSON.stringify(rankingBreakdowns, null, 2)}\n`);

  const malaysiaYear = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' }).format(new Date()));
  const calendars = {};
  for (const year of [malaysiaYear - 1, malaysiaYear]) {
    const calendarPage = await context.newPage();
    const status = year === malaysiaYear ? 'remaining' : 'all';
    await calendarPage.goto(calendarUrl(year, status), { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await calendarPage.locator('main table tbody tr').first().waitFor({ state: 'visible', timeout: 60_000 });
    const items = await calendarPage.locator('main table tbody tr').evaluateAll((rows) => rows.map((row) => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length < 7) return null;
      return {
        week: (cells[0].textContent || '').trim(),
        name: (cells[3].textContent || '').replace(/\s+/g, ' ').trim(),
        category: (cells[5].textContent || '').replace(/\s+/g, ' ').trim(),
        city: (cells[6].textContent || '').replace(/\s+/g, ' ').trim(),
      };
    }).filter((item) => item?.name));
    calendars[String(year)] = Array.from(new Map(items.map((item) => [`${item.week}|${item.name}|${item.category}|${item.city}`, item])).values());
    console.log(`${year} calendar: refreshed ${calendars[String(year)].length} entries`);
    await calendarPage.close();
  }
  await writeFile('lib/tournament-calendars.json', `${JSON.stringify({ generatedAt, calendars }, null, 2)}\n`);
} finally {
  await browser.close();
}
