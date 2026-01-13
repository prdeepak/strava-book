** GOAL **
My goal is to get to a finished POC book as quickly as possible, then add in more AI functionality over time.  Simplify the architecture as we go.

# Phase 1:  make a nice-looking, simple "safe path" book 
* Define an algorithmic "safe path" / default BookManifest, doesn't need AI

* For each section of the default BookManifest, define an algorithmic "safe path" / default layout (template + variant), using existing templates + variants

  - Work through each default layout to ensure it's visually appealing as a "base case"

  - Work through BookManifest in a specific order, to prevent too much duplication.  E.g., 
    (i) identify A-race + other races; 
    (ii) work month by month to identify "spotlight" events, descriptions, comments [eg., spotlight event = event with most comments; or, if a tie, the one with most significant PRs or highest effort] + spotlight photos = hero photos from top [x] events as ranked by the same algorithm; 
    (iii) some way to choose cover + back cover / background image -- e.g., cover = second photo from A-race; back cover = same, but B&W and very faint

  - Fix ActivityLog to be more like TrainingSparkle
  - Fix MonthlyDivider to feature spotlights (see above); and perhaps to show "streaks" style calendar
  - Fix RaceSection to take 4+ pages, include all key details with a focus on emotional resonance (description, comments, photos, map, PRs, splits, elevation -- in that order)
  - Fix YearCalendar to show "training" or GitHub-style heatmap

  - When not enough images to fill a collage section, consider either (a) filling remaining image boxes with a complementary color; (b) inserting comments; (c) ... other?

# Phase 2:  Add back AI in specific places

E.g.,
* Colors + fonts -- whole book; plus race sections (based on race name)
* Choose key photos
* Generate photos for important events without them

# Phase 3:  Refactor to simplify architecture
* (tbc)
