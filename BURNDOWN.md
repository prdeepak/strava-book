# PDF Quality Burndown List

Generated from review of: `my-running-journey-ai-designed (4).pdf`

## Priority 1: Blocking / Embarrassing
| # | Issue | Status | Notes |
|---|-------|--------|-------|
| 1 | Placeholder "ATHLETE" name on cover | DONE | Fixed data flow: session → builder → modal |
| 2 | 2024 races appearing in 2025 book | DONE | ws-d15b80: Flexible date range replaces fixed year concept (PR #14) |
| 3 | Broken emoji rendering (`<Ê<ýB`) | TODO | Activity titles showing garbled characters |
| 4 | "VECTOR MAP" debug watermark visible | TODO | Remove from map pages |

## Priority 2: Missing Core Content
| # | Issue | Status | Notes |
|---|-------|--------|-------|
| 5 | No photos anywhere in book | DONE | Fixed in ws-e50d30: fetch photos via comprehensive API (PR #15) |
| 6 | Maps have no satellite/terrain imagery | DONE | Fixed in ws-e50d30: pass mapboxToken to templates (PR #15) |
| 7 | No activity descriptions/notes | TODO | User's Strava descriptions not shown |
| 8 | No Strava comments displayed | TODO | Social engagement missing |
| 9 | No split times on race pages | TODO | Key race data missing |
| 10 | No elevation profile graphs | TODO | Important for showcasing terrain |

## Priority 3: Data Accuracy
| # | Issue | Status | Notes |
|---|-------|--------|-------|
| 11 | Wrong location: Around the Bay → "Toronto" | TODO | Should be Hamilton |
| 12 | Wrong location: Comrades → "Johannesburg" | TODO | Should be Durban/Pietermaritzburg |
| 13 | Activity log not chronological | TODO | Dates jump around within pages |

## Priority 4: Design Polish
| # | Issue | Status | Notes |
|---|-------|--------|-------|
| 14 | Awkward month hyphenation | TODO | "JANU-ARY" "SEP-TEM-BER" etc |
| 15 | Generic "Training Journal (X/15)" titles | TODO | Replace with meaningful names |
| 16 | 0km activities take same space as runs | TODO | Filter or de-emphasize mobility/strength |
| 17 | Empty white space on month dividers | TODO | Add photos or reduce layout |
| 18 | TOC page numbers confusing | TODO | Months/races interleaved oddly |

## Priority 5: Nice to Have
| # | Issue | Status | Notes |
|---|-------|--------|-------|
| 19 | Generic back cover quote | TODO | Could personalize |
| 20 | No year-over-year comparison | TODO | If multi-year data available |

---

## Status Key
- `TODO` - Not started
- `IN PROGRESS` - Being worked on
- `DONE` - Completed
- `WONTFIX` - Decided not to fix

## Assignment Log
| Issue # | Assigned To | Started | Completed |
|---------|-------------|---------|-----------|
| | | | |
