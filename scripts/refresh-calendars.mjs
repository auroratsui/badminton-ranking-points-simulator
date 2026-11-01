import { readFile, writeFile, rename } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

export async function fetchTournamentCalendar(context, year, status) {
  const url = `https://corporate.bwfbadminton.com/events/calendar/${year}/${status}/0/-1/`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const page = await context.newPage();
    let response;
    try {
      response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      if (response && !response.ok()) throw new Error(`HTTP ${response.status()}`);
      // Read attached calendar rows: CSS visibility is not a data-validation rule.
      // Scope to the actual event tables rather than depending on a main wrapper.
      const rows = page.locator('table.tblResultLanding tbody tr');
      await rows.first().waitFor({ state: 'attached', timeout: 20_000 });
      if (response && !response.ok()) throw new Error(`HTTP ${response.status()}`);
      if (!(await page.title()).includes(String(year))) throw new Error('Calendar year could not be verified');
      const items = await rows.evaluateAll(calendarRows => calendarRows.map(row => {
        const cells = [...row.querySelectorAll('td')];
        if (cells.length < 7) return null;
        const text = cell => (cell?.textContent || '').replace(/\s+/g, ' ').trim();
        return {
          week: text(cells[0]).padStart(2, '0'),
          country: text(cells[1].querySelector('.country_code')) || cells[1].querySelector('img')?.getAttribute('alt') || '',
          name: text(cells[3]), category: text(cells[5]), city: text(cells[6]),
        };
      }).filter(Boolean));
      if (!items.length || items.some(item => !item.name || !item.category || !/^\d{2}$/.test(item.week) || Number(item.week) < 1 || Number(item.week) > 53)) {
        throw new Error('Empty or malformed calendar rows');
      }
      return [...new Map(items.map(item => [`${item.week}|${item.country}|${item.name}|${item.category}|${item.city}`, item])).values()];
    } catch (error) {
      const title = await page.title().catch(() => '(unreadable)');
      const rows = await page.locator('table.tblResultLanding tbody tr').count().catch(() => 0);
      console.warn(`${year} calendar refresh failed (attempt ${attempt}/3): ${error.message.split('\n')[0]}; HTTP ${response?.status() ?? 'unknown'}; title=${JSON.stringify(title)}; event rows=${rows}`);
      if (response?.status() === 403) {
        console.warn(`${year}: source access blocked; stopping retries and keeping the saved calendar`);
        return null;
      }
    } finally { await page.close(); }
  }
  return null;
}

export async function refreshCalendars(context, currentYear = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' }).format(new Date())), years = [currentYear - 1, currentYear, currentYear + 1]) {
  const destination = new URL('../lib/tournament-calendars.json', import.meta.url);
  const previous = await readFile(destination, 'utf8').then(JSON.parse).catch(() => ({ calendars: {} }));
  const calendars = { ...previous.calendars };
  const refreshedAtByYear = { ...previous.refreshedAtByYear };
  let changed = false;
  for (const year of years) {
    // Keep the full current year for next year's previous-edition matching.
    const items = await fetchTournamentCalendar(context, year, year > currentYear ? 'remaining' : 'all');
    if (items) {
      calendars[year] = items;
      refreshedAtByYear[year] = new Date().toISOString();
      changed = true;
      console.log(`${year} calendar: refreshed ${items.length} entries`);
    } else {
      console.warn(`${year} calendar: preserved ${calendars[year]?.length ?? 0} previously saved entries (not refreshed)`);
    }
  }
  if (changed) {
    const temporary = new URL('../lib/tournament-calendars.json.tmp', import.meta.url);
    await writeFile(temporary, `${JSON.stringify({ ...previous, generatedAt: new Date().toISOString(), refreshedAtByYear, calendars }, null, 2)}\n`);
    await rename(temporary, destination);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' });
    const years = process.argv.slice(2).map(Number);
    if (years.some(year => !Number.isInteger(year) || year < 2000 || year > 2100)) throw new Error('Pass calendar years such as 2027');
    await refreshCalendars(context, undefined, years.length ? years : undefined);
  } finally { await browser.close(); }
}
