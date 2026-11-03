# Upcoming Entries

This implementation was written from scratch. It does not invoke or depend on the badminton-entry-checker skill.

The standalone `/upcoming-entries/` page uses the existing top-200 database for suggestions; full names can also be entered manually. Select the discipline separately. For doubles, selecting the full pair matches both partners; a full individual name can also find that person's pair entries.

## Data collection

`pnpm refresh-entries` visits the current BWF remaining-events calendar and the following year when necessary. Actual event start/end dates must agree with the calendar week. The window includes events whose dates overlap today through day 42. Junior and cancelled tournaments are excluded.

All calendar detail/download links are read from their actual DOM containers, including collapsed sections. The highest numbered M/Q version wins; seeding-only reports do not qualify. The PDF parser reads the named player columns and actual Type and Position columns, retains partner boundaries, follows discipline headings across continuation pages, and rejects unsupported or incomplete reports. It does not confuse world rank or seed with entry position.

Image-only/unsupported PDFs, missing reports, and failed downloads fall back first to the official World Tour Players host, then the main BWF Players host. Both layouts are supported, including exact discipline tabs and the Event menu. The calendar’s canonical tournament path is retained; the old collector incorrectly forced everything to the main host. The fallback validates the tournament title, selects each discipline, waits for its content, and reads the source's M/Q/R codes and player name fields. It validates section row counts and partner counts. Removed and Withdrawn are separate source statuses. A native report or Players collection must cover all five disciplines before it is published as ready. Exact repeated player/status records (including promoted players repeated in two lists) are deduplicated after each section’s published row count is checked. Player-name extraction excludes WDN/SWM badges; explicit withdrawn status is preserved.

BWF sometimes returns Cloudflare HTTP 403. Requests run sequentially with a one-second pause. No challenge bypass is used. Browser collection omits image/font/media downloads to reduce unnecessary traffic. If both Players hosts fail, a downloaded image-based acceptance report is read using bundled local OCR models. Only rows with explicit list heading, list position, member ID and complete partner identities above confidence thresholds are retained; OCR collections are always marked partial and cannot establish absence. Low-confidence rows are omitted, not guessed. Page extraction is cached by image SHA-256 for subsequent refreshes. A failed source preserves any prior verified entries and labels them stale; otherwise the event is unavailable. No match in incomplete coverage does not establish non-entry. A failed calendar for every relevant year preserves the existing complete dataset and fails the workflow.

## Initial data and live checks

Collected on 3 November 2026 for the 3 November–15 December window: 32 non-junior, non-cancelled tournaments. The improved initial snapshot contains 2,496 usable entries across nine tournaments: five complete lists and four partial image-report lists. Complete lists: Telangana, Korea Open, Kumamoto, Irish Open and Guwahati. Partial image reports: Nan’an China International Challenge, Kaohsiung Masters, Hong Kong Open and Syed Modi. The other 23 events remain blocked/unreadable; they are not claimed as confirmed absences. See ENTRY_SOURCE_AUDIT.md for the event-by-event result.

Kaloyana Nalbantova / WS is confirmed in Korea Open as M12 and Kumamoto as Q2. Native PDF and all-five-discipline Players-page checks were used for complete lists. Image-report collections remain partial even when many rows are readable.

## GitHub setup

Upload the complete package contents, including hidden `.github` and `.openai`, to the existing repository. Pages must use GitHub Actions. Allow Actions to write repository contents. The **Refresh upcoming tournament entries** workflow is manual-only. It has no scheduled trigger while the feature is experimental. The main simulator retains its Tuesday 07:24 UTC ranking/calendar refresh. It installs Playwright Chromium and PyMuPDF, runs the collector, commits `lib/upcoming-entries.json`, and the existing Pages deployment workflow republishes the site after this workflow succeeds. Existing Tuesday ranking refreshes remain separate.

For a first manual refresh, choose Actions → Refresh upcoming tournament entries → Run workflow. Review its logs and the tab's coverage section. Scheduled runs can be delayed by GitHub; check that schedules remain enabled.

Local setup: `pnpm install --frozen-lockfile`, Python 3.12, `pip install -r scripts/entries/requirements.txt`, and `pnpm exec playwright install chromium`. Use `PYTHON=/path/to/python pnpm refresh-entries` if needed. No account credentials or API keys are required.

## Verification

- `pnpm test`: existing ranking regressions plus entry version/date-window tests.
- `python3 -m unittest discover -s scripts/entries -p 'test_*.py'`: synthetic PDF discipline, status/position, pair-integrity and unreadable-document tests.
- `pnpm exec tsc --noEmit` and `pnpm build`.
- With `pnpm dev` running, `node scripts/check-entry-ui.mjs`: live-data Q2 result, discipline isolation, autocorrect off, and mobile layout.

Player search uses the same styled dropdown component as Default and Crystal Ball. The tab displays no external hyperlinks; source URLs are retained only in the collected data for maintenance. Source freshness and coverage are visible in the tab. It needs a newly collected snapshot to cover a later date window.


## Alternative-source investigation, 3 November 2026

The World Tour host was independently verified to serve Korea Open (234 entries across all five disciplines) and Irish Open (259 entries across all five disciplines), while the main host intermittently returned HTTP 403. World Tour is therefore attempted for International Challenge and other senior events too, with tournament-title validation before using any rows. A fresh full-window coverage audit is stored in the accompanying release notes.

Tournamentsoftware’s BWF event landing page redirected to the BWF Fansite rather than providing an independent M/Q source. Association-hosted entry files inspected from Maharashtra included national group-entry confirmations rather than a full acceptance list; those documents were rejected as a source of M/Q/R positions. Neither registration order nor ranking/seed numbers are substituted for entry position. The source URLs are retained in the dataset for auditing and remain hidden in the user interface.
