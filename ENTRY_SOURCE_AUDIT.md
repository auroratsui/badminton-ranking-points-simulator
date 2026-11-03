# Entry-source audit — 3 November 2026

Outcome: 9 of 32 events have usable entries, including 5 complete lists and 4 partial image reports. The remaining 23 are still unavailable. This does not establish non-entry for any player.

| Tournament | Coverage | Entries | Source |
|---|---|---:|---|
| Telangana India International Challenge 2026 | ready | 458 | players |
| WANG WENJIAO CUP Nan'an China International Challenge 2026 | partial | 151 | pdf-image |
| YEOSU VICTOR Korea Open 2026 | ready | 234 | players |
| FZ FORZA Norwegian International 2026 | unavailable | 0 | blocked/unreadable |
| Kumamoto Masters Japan 2026 | ready | 275 | pdf |
| VICTOR Kaohsiung Masters 2026 | partial | 215 | pdf-image |
| AIG VICTOR Irish Open 2026 | ready | 259 | players |
| XVII Suriname International 2026 | unavailable | 0 | blocked/unreadable |
| YONEX South Australia International 2026 | unavailable | 0 | blocked/unreadable |
| Zambia International 2026 | unavailable | 0 | blocked/unreadable |
| Guatemala International Series 2026 | unavailable | 0 | blocked/unreadable |
| LI-NING Hong Kong Open 2026 | partial | 237 | pdf-image |
| POLYTRON Yogyakarta International Challenge 2026 | unavailable | 0 | blocked/unreadable |
| NAVEK Türkiye International Future Series 2026 | unavailable | 0 | blocked/unreadable |
| YONEX Melbourne International 2026 | unavailable | 0 | blocked/unreadable |
| Scottish Open 2026 | unavailable | 0 | blocked/unreadable |
| Syed Modi India International 2026 | partial | 283 | pdf-image |
| TOYOTA International Challenge 2026 | unavailable | 0 | blocked/unreadable |
| VIII El Salvador International 2026 | unavailable | 0 | blocked/unreadable |
| South Africa International 2026 | unavailable | 0 | blocked/unreadable |
| YONEX Welsh International Open 2026 | unavailable | 0 | blocked/unreadable |
| 2026 YONEX Canadian International Challenge | unavailable | 0 | blocked/unreadable |
| FELET Vietnam International Series 2026 | unavailable | 0 | blocked/unreadable |
| YONEX-SUNRISE Guwahati Masters 2026 | ready | 384 | players |
| 2027 European Mixed Team Championships Qualification - Czechia | unavailable | 0 | blocked/unreadable |
| 2027 European Mixed Team Championships Qualification - Poland | unavailable | 0 | blocked/unreadable |
| Algeria International 2026 | unavailable | 0 | blocked/unreadable |
| Egypt International 2026 | unavailable | 0 | blocked/unreadable |
| Odisha Masters 2026 | unavailable | 0 | blocked/unreadable |
| YONEX LA International Series 2026 | unavailable | 0 | blocked/unreadable |
| HSBC BWF World Tour Finals 2026 | unavailable | 0 | blocked/unreadable |
| I FEEL SLOVENIA LI-NING Future Series 2026 | unavailable | 0 | blocked/unreadable |

## What was tested

- BWF World Tour host: successful full five-discipline extraction for Korea Open (234) and Irish Open (259), with tournament identity and row-count checks. Bulk access can still be blocked; it is an alternative host, not a guarantee of availability.
- Main BWF host: Telangana (458) and independently validated Guwahati (384). Source records retain their actual individual verification timestamps.
- Original Kumamoto PDF: 275 entries, including Nalbantova WS Q2 on page 3.
- Image PDFs: confidence-gated row extraction, always marked partial. Four newly usable events add 886 entries.
- Tournamentsoftware BWF landing page: redirects to the BWF Fansite. General public host stopped at its consent page in the tested browser; it was not accepted as a working position source.
- Maharashtra association entry-file mirrors: tested examples were national group-entry confirmations, without global acceptance positions. They were not used to fabricate M/Q/R codes.
- Direct BWF data endpoints: HTTP 403 in the tested command-line requests; not used as an unverified workaround.

The collector tries the latest report, World Tour Players host, main Players host, then confidence-gated extraction of the downloaded image report. Existing source URLs remain internal; no hyperlinks were added to the product interface.
