# Badminton World Ranking Points Simulator

A multi-player BWF world-ranking points simulator. It automatically loads each selected player or pair's published BWF score breakdown and supports the best-ten, 52-week expiry, previous-edition replacement, and single team-tournament score rules.

The player search index contains the top 200 players or pairs in each of the five BWF disciplines. A scheduled GitHub Actions workflow refreshes the rankings, every player's score breakdown, the current year's remaining tournaments, and the previous year's full tournament calendar every Tuesday at 15:24 GMT+8 (07:24 UTC), shortly after BWF publishes its ranking update.

## Local development

```bash
pnpm install
pnpm dev
```

## GitHub Pages

The repository includes Pages and weekly data-refresh workflows. Follow [GITHUB_SETUP.md](GITHUB_SETUP.md) to upload the package and publish it with GitHub Pages. Every later push to `main` rebuilds and publishes the simulator, including weekly automated data refreshes.

## Race-to-Finals projections (2026)

Default-mode player cards show **Projected Race-to-Finals Points** when the selected player/pair matches the saved Race-to-Finals top 25 for that discipline. Crystal Ball and all World Ranking calculations remain separate. The compact box sits below Hypothetical Result on desktop and below the main projection on mobile; no projection is shown until a tournament and result are selected.

The simulator's existing Tuesday **07:24 UTC (15:24 GMT+8)** workflow also runs `scripts/refresh-race-to-finals.mjs`. This independently collects the Tournamentsoftware Race-to-Finals ranking (`rid=211`) into `lib/race-to-finals-data.json`; it does not read, modify, or depend on the separate workbook repository. To refresh just this dataset, run `pnpm refresh-race-to-finals` after installing Playwright Chromium.

The collector discovers the current edition, verifies the identity of each results table, retains all results, and checks both the published counting-score sum and the independently calculated total. Tournamentsoftware's tournament results pages omit the grade, so the collector identifies each level from its champion award, requiring all five disciplines to agree with the supplied tour points table. Only a fully validated set of 125 entries replaces the saved JSON. A failed Race-to-Finals refresh preserves the previous snapshot and does not prevent the World Ranking refresh from being committed.

The 2026 calculation includes only Super 100/300/500/750/1000 events from **2025-W48 through 2026-W47**, with at most three Super 100 results selected before taking the best 14 overall. It uses the existing simulator awards. There is no rolling expiry or previous-edition replacement. Excluded event levels leave the total unchanged; W48–W49 results belong to the 2027 race and are not added to 2026. At W50 or later, the box reports that the 2026 season has ended. Projections for weeks before the saved ranking reference are unavailable because the current snapshot cannot reconstruct a past ranking.

This integration is intentionally scoped to the 2026 race: a future-season source is rejected rather than mixed into these totals. A new season requires an explicit season configuration update.

Run `pnpm test` for calculation and saved-data validation, and `pnpm exec tsc --noEmit` for type checking. With `pnpm dev` running, `node scripts/check-race-ui.mjs` checks the desktop/mobile box behavior and writes preview screenshots to `/tmp`.
