2026-01-20
*** GENERATE BOOK MANUALLY (NO AI) ***

Rebuild the "Generate Book" process from scratch as follows.  Replace existing process and code.

#. Change name of button from "Generate Year Book" to "Geneerate Book"
#. Launch modal
#. User: confirm from-to dates for book
#. System: getAthleteActivities() for the date range
#. System: getActivityForPdf() for all Races in daterange
#. System: getActivityForPdf() for all Highlight Activities in daterange (one per month)

#. User: chooses book name; types optional Foreword text
#. User: chooses among all high-res photos available within the daterange (either because a Race, a Highlight Activity, or otherwise happens already to be cached) for: {cover photo; background photo; back cover photo}

#. System: generate book pdf
  ##. All pages: set standard (static) BookFormat, BookTheme, DEFAULT_THEME, FORMATS.  Use existing default templates, but fix as described below
  ##. All pages: ensure the final output pages are exactly the right dimensions (e.g. 10x10) and resolution (e.g. 300 dpi).  (Some of the existing templates are yielding rectangles if there not enough / too much information for a clean square; should either pad white space or divide into multiple pages such that every page is exactly the right dimensions)
  ##. All pages: note, the period chosen MAY NOT be a year
    - so it's imperative that we use the date range (e.g., "YYYY" only if period is exactly a year, else "Mmm - Mmm YY" or "Mmm YY - Mmm YY" as appropriate). 
    - Also, all graphs and calendars should cover the user-chosen daterange, in order -- e.g., if the daterange is 2025-07-01 to 2025-12-31, then any calendar or graphs should show July 2025 through December 2025, in date order.
  ##. Cover
  ##. Foreword -- use background photo, relatively prominent (but text should still be clear); auto-adjust text size to fit (centered vertically + horizontally)within page with 1" margins on all sides. 
    - This is a new template, so use visual_judge loop to iterate the template design up to 5 times until score is > 80
  ##. TOC -- use faint / faded background photo? (much fainter than Foreword)
  ##. YearStats -- use faint / faded background photo? Or solid background?
  ##. Year calendar -- note fix: page title and calendar should match daterange, not assume a year
  ##. Race pages -- use racespread template; but include _all_ photos from the race
    - Also, restrict comments to one page; consider using two columns and smaller text to display all comments
  ##. Month Divider pages -- compose new 2-page spread (left page + right page) displaying: (a) small CalendarIconView for the month (~1/4 of the page); (b) hero photo + 1-2 comments from the HighlightActivity for that month, font can be relatively small (e.g., 10-12pt).  
    - This is a new template (replace existing MonthDivider template), so use visual_judge loop to iterate the template design up to 5 times until score is > 80
  ##. ActivityLog for month
  ##. Back cover -- use back cover photo, relatively prominent (but text should still be clear); auto-adjust text size to fit (centered vertically + horizontally)within page with 1" margins on all sides

#. System: send each page of generated PDF to visual_judge for scoring; save results in a single .md file
#. System: automatically download PDF book + visual_judge results .md file

