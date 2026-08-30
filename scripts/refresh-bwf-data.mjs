import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const rankingUrl = 'https://bwfbadminton.com/rankings/';
const calendarUrl = (year, status = 'all') => `https://corporate.bwfbadminton.com/events/calendar/${year}/${status}/0/-1/`;
const disciplines = [
  { code: 'MS', discipline: 'Men’s Singles', tab: "MEN'S SINGLES" },
  { code: 'WS', discipline: 'Women’s Singles', tab: "WOMEN'S SINGLES" },
  { code: 'MD', discipline: 'Men’s Doubles', tab: "MEN'S DOUBLES" },
  { code: 'WD', discipline: 'Women’s Doubles', tab: "WOMEN'S DOUBLES" },
  { code: 'XD', discipline: 'Mixed Doubles', tab: "MIXED DOUBLES" },
];

const browser = await chromium.launch({
  headless: true,
  args: ['--disable-blink-features=AutomationControlled'],
});
const context = await browser.newContext({
  locale: 'en-GB',
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
});

try {
  const page = await context.newPage();
  await page.goto(rankingUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const rankingTable = page.locator('table').first();
  await rankingTable.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 60_000 });

  await page.getByRole('button', { name: /Per page/ }).click();
  await page.getByRole('option', { name: '100', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length >= 100, undefined, { timeout: 30_000 });

  const weekText = await page.getByRole('button', { name: /Week Week/ }).innerText();
  const weekMatch = /Week\s+(\d+)\s+\((\d{4}-\d{2}-\d{2})\)/.exec(weekText.replace(/\s+/g, ' '));
  if (!weekMatch) throw new Error(`Could not read ranking week from: ${weekText}`);

  const rankingPlayers = [];
  const rankingBreakdowns = {};

  for (let disciplineIndex = 0; disciplineIndex < disciplines.length; disciplineIndex += 1) {
    const config = disciplines[disciplineIndex];
    if (disciplineIndex > 0) {
      await page.getByRole('link', { name: config.tab, exact: true }).click();
      await page.waitForTimeout(900);
      await page.waitForFunction(() => document.querySelectorAll('table tbody tr').length >= 100, undefined, { timeout: 30_000 });
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
      await row.locator('button').click({ timeout: 15_000 });
      const dialog = page.locator('.v-dialog--active');
      await dialog.waitFor({ state: 'visible', timeout: 15_000 });
      await page.waitForTimeout(120);

      const scores = await dialog.locator('table tbody tr').evaluateAll((scoreRows) => scoreRows.map((scoreRow) => {
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

      rankingBreakdowns[rankingKey] = { name: player.name, profiles: [player.href], scores };
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      await dialog.waitFor({ state: 'hidden', timeout: 10_000 });
    }

    console.log(`${config.code}: refreshed 100 entries`);
  }

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
