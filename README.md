# Badminton World Ranking Points Simulator

A multi-player BWF world-ranking points simulator. It automatically loads each selected player or pair's published BWF score breakdown and supports the best-ten, 52-week expiry, previous-edition replacement, and single team-tournament score rules.

The player search index contains the top 100 players or pairs in each of the five BWF disciplines. A scheduled GitHub Actions workflow refreshes the rankings, every player's score breakdown, the current year's remaining tournaments, and the previous year's full tournament calendar every Tuesday at 09:30 GMT+1, shortly after BWF publishes its ranking update.

## Local development

```bash
pnpm install
pnpm dev
```

## GitHub Pages

The repository includes Pages and weekly data-refresh workflows. Follow [GITHUB_SETUP.md](GITHUB_SETUP.md) to upload the package and publish it with GitHub Pages. Every later push to `main` rebuilds and publishes the simulator, including weekly automated data refreshes.
