# Badminton World Ranking Points Simulator

A multi-player BWF world-ranking points simulator. It automatically loads each selected player or pair's published BWF score breakdown and supports the best-ten, 52-week expiry, previous-edition replacement, and single team-tournament score rules.

The player search index contains the top 200 players or pairs in each of the five BWF disciplines. A scheduled GitHub Actions workflow refreshes the rankings, every player's score breakdown, the previous and current years' full tournament calendars, and the following year's remaining events every Tuesday at 15:24 GMT+8 (07:24 UTC), shortly after BWF publishes its ranking update.

## Local development

```bash
pnpm install
pnpm dev
```

## GitHub Pages

The repository includes Pages and weekly data-refresh workflows. Follow [GITHUB_SETUP.md](GITHUB_SETUP.md) to upload the package and publish it with GitHub Pages. Every later push to `main` rebuilds and publishes the simulator, including weekly automated data refreshes.

## Race-to-Finals projections

Default-mode player cards show **Projected Race-to-Finals Points** when the selected player/pair matches the saved Race-to-Finals top 25 for that discipline. Crystal Ball and all World Ranking calculations remain separate. The compact box sits below Hypothetical Result on desktop and below the main projection on mobile; no projection is shown until a tournament and result are selected.

The simulator's existing Tuesday **07:24 UTC (15:24 GMT+8)** workflow also runs `scripts/refresh-race-to-finals.mjs`. This independently collects the Tournamentsoftware Race-to-Finals ranking (`rid=211`) into `lib/race-to-finals-data.json`; it does not read, modify, or depend on the separate workbook repository. To refresh just this dataset, run `pnpm refresh-race-to-finals` after installing Playwright Chromium.

The collector discovers the current edition, verifies the identity of each results table, retains all results, and checks both the published counting-score sum and the independently calculated total. Tournamentsoftware's tournament results pages omit the grade, so the collector identifies each level from its champion award, requiring all five disciplines to agree with the supplied tour points table. Only a fully validated set of 125 entries replaces the saved JSON. A failed Race-to-Finals refresh preserves the previous snapshot and does not prevent the World Ranking refresh from being committed.

The 2026 calculation includes only Super 100/300/500/750/1000 events from **2025-W48 through 2026-W47**, with at most three Super 100 results selected before taking the best 14 overall. It uses the existing simulator awards. There is no rolling expiry or previous-edition replacement. W48 starts the next Race-to-Finals season: 2026-W48 through 2027-W47 belongs to 2027. No prior-season points carry forward. A future season starts from zero until a validated snapshot for that season supplies a current balance. Excluded event levels leave that season’s balance unchanged, including World Tour Finals. Projections for weeks before the saved ranking reference are unavailable because the current snapshot cannot reconstruct a past ranking.

The collector identifies the season from all result weeks and rejects mixed-season datasets. The box’s “from” value is the balance for the simulated season. The help icon explains the top-25 display requirement.

Run `pnpm test` for calculation and saved-data validation, and `pnpm exec tsc --noEmit` for type checking. With `pnpm dev` running, `node scripts/check-race-ui.mjs` checks the desktop/mobile box behavior and writes preview screenshots to `/tmp`.


## Calendars and 2027 tournaments

The weekly World Ranking refresh also collects calendars for the previous, current, and following years. Previous/current years are saved in full so next-year tournaments can match their previous editions; the following year's remaining events are loaded too. Both tabs offer current and next-year tournament choices.

Run `pnpm refresh-calendars` to update just the calendars, or `pnpm refresh-calendars 2027` for one year. A calendar failure preserves that year's saved entries. Diagnostics include the HTTP status, page title, and event-row count. HTTP 403 with a “Just a moment…” title means the source returned a Cloudflare access challenge instead of the calendar; retries stop for that year. Saved entries may remain usable but are not newly refreshed. `refreshedAtByYear` records successful collections individually.

Starting with tournament weeks in 2027, both Super 1000 levels offer R64 in Default and Crystal Ball results and in generated scenario tables. Existing award values are used: China Open 1,350; other Super 1000 events 1,200. These awards also feed the separate Race-to-Finals projection.
