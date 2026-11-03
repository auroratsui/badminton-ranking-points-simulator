# Upcoming Entries

This implementation was written from scratch. It does not invoke or depend on the badminton-entry-checker skill.

The third tab uses the existing top-200 database for suggestions; full names can also be entered manually. Select the discipline separately. For doubles, selecting the full pair matches both partners; a full individual name can also find that person's pair entries.

## Data collection

`pnpm refresh-entries` visits the current BWF remaining-events calendar and the following year when necessary. Actual event start/end dates must agree with the calendar week. The window includes events whose dates overlap today through day 42. Junior and cancelled tournaments are excluded.

All calendar detail/download links are read from their actual DOM containers, including collapsed sections. The highest numbered M/Q version wins; seeding-only reports do not qualify. The PDF parser reads the named player columns and actual Type and Position columns, retains partner boundaries, follows discipline headings across continuation pages, and rejects unsupported or incomplete reports. It does not confuse world rank or seed with entry position.

Image-only/unsupported PDFs, missing reports, and failed downloads fall back to the official Players page. The fallback validates the tournament title, selects each discipline, waits for its content, and reads the source's M/Q/R codes and player name fields. It validates section row counts and partner counts. Removed and Withdrawn are separate source statuses. A report must cover all five disciplines before it is published as ready.

BWF sometimes returns Cloudflare HTTP 403. Requests run sequentially with a one-second pause. No challenge bypass or OCR-based guesses are used. A failed source preserves any prior verified entries and labels them stale; otherwise the event is unavailable. No match in incomplete coverage does not establish non-entry. A failed calendar for every relevant year preserves the existing complete dataset and fails the workflow.

## Initial data and live checks

Collected on 3 November 2026 for the 3 November–15 December window: 32 non-junior, non-cancelled tournaments. Kumamoto's native PDF yielded 275 entries; the independent live Guwahati fallback yielded 384 entries across all five disciplines. Kaloyana Nalbantova appears as WS Q2 in Kumamoto, page 3. Many other event requests were blocked or lacked usable lists and are explicitly marked unavailable. These are genuine collection limitations, not confirmed absences. The initial dataset does not claim complete coverage.

## GitHub setup

Upload the complete package contents, including hidden `.github` and `.openai`, to the existing repository. Pages must use GitHub Actions. Allow Actions to write repository contents. The new **Refresh upcoming tournament entries** workflow runs daily at **06:17 UTC** and also supports manual dispatch. It installs Playwright Chromium and PyMuPDF, runs the collector, commits `lib/upcoming-entries.json`, and the existing Pages deployment workflow republishes the site after this workflow succeeds. Existing Tuesday ranking refreshes remain separate.

For a first manual refresh, choose Actions → Refresh upcoming tournament entries → Run workflow. Review its logs and the tab's coverage section. Scheduled runs can be delayed by GitHub; check that schedules remain enabled.

Local setup: `pnpm install --frozen-lockfile`, Python 3.12, `pip install PyMuPDF==1.26.5`, and `pnpm exec playwright install chromium`. Use `PYTHON=/path/to/python pnpm refresh-entries` if needed. No account credentials or API keys are required.

## Verification

- `pnpm test`: existing ranking regressions plus entry version/date-window tests.
- `python3 -m unittest discover -s scripts/entries -p 'test_*.py'`: synthetic PDF discipline, status/position, pair-integrity and unreadable-document tests.
- `pnpm exec tsc --noEmit` and `pnpm build`.
- With `pnpm dev` running, `node scripts/check-entry-ui.mjs`: live-data Q2 result, discipline isolation, autocorrect off, and mobile layout.

Source freshness and coverage are visible in the tab. It needs a newly collected snapshot to cover a later date window.
