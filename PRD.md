# Product Requirements Document (PRD)
**Project Name:** MedalBook (formerly Strava Commemorative Book)
**Version:** 0.2
**Status:** In Development
**Vision:** "Your Training Period, Curated by AI, Printed for the Coffee Table."

## 1. Executive Summary
MedalBook is a premium web application that transforms any user-selected period of Strava data into a high-design, physical coffee-table book. Unlike generic "stats dumps," MedalBook uses an intelligent curation engine to identify key narrative moments (A-Races, training blocks, accomplishments) and presents them in a visually stunning, magazine-quality layout.

**Core Value Prop:** Automation + Aesthetic. The user should not have to drag-and-drop every page. The system provides a "Smart Draft" that is 90% perfect, utilizing huge photos, satellite cartography, and professional typography.

## 2. Product Principles
1.  **Coffee-table Book Aesthetic:** The visual target is a high-end aesthetic -- nice enough to give as a gift or keep on your coffee table -- not a spreadsheet.
2.  **Ink on Paper:** Every design decision must prioritize print fidelity. We use `React-PDF` to ensure pixel-perfect 300dpi output.
3.  **Beautiful Design:** We use professional typography, high-quality images, and a clean layout to create a visually stunning book.
4.  **Curation over Collection:** We do not print every 5k recovery run on its own page. We summarize the grind (Activity Logs) and celebrate the glory (Race Sections).
5. **Emphasize emotional content:** When curating, focus on the higher-emotion components -- e.g., races, group runs, activities with photos and comments when choosing activities; and within each activity, the descriptions, photos, kuddos + comments should stand out.  Also visual elements such as maps, elevation profiles, splits charts.
6.  **Agentic Customization:** The agent should customize the book based on the data -- e.g., choose relevant colors, fonts, layouts; add web images or AI-generated images.  Each book should look as if it was bespoke, and not a carbon-copy of the others. 
7.  **User Customization:** The user can customize the book, limited to high-impact choices (e.g., "Change Cover Photo," "Swap Theme Colors"). We avoid granular "move this pixel" editing to maintain design integrity.
8.  **Agentic Polish:** We use AI agents (`overnight-agents.sh`) to iteratively refine layouts, ensuring text doesn't overlap and photos are optimally cropped.

## 3. User Flow
### Phase 1: Ingestion & Analysis
-   **Connect:** User auths with Strava (`activity:read_all`).
-   **Analyze:** System pulls all activities for the selected year.
-   **Classify:** The `BookDocument` engine identifies:
    -   **Races:** (Marathons, Ultras, PRs) -> Eligible for *Race Spreads*.
    -   **Training:** (Daily runs) -> Grouped into *Activity Logs* and *Monthly Dividers*.
    -   **Narrative Arcs:** (e.g., "The Build to Boston").

### Phase 2: The "Smart Draft"
-   User is presented with a generated digital preview of the book.
-   **Heuristic:** The system automatically selects the layout variant based on asset density:
    -   *Lots of photos + Description?* -> **Full Spread (6 pages)**.
    -   *Good stats + Map?* -> **Standard (4 pages)**.
    -   *Just the basics?* -> **Compact (2 pages)**.

### Phase 3: High-Fidelity Preview & Order
-   User flips through the PDF preview.
-   **Customization:** Limited to high-impact choices (e.g., "Change Cover Photo," "Swap Theme Colors"). We avoid granular "move this pixel" editing to maintain design integrity.
-   **Output:** Generates a print-ready PDF (standard PDF/X-4 compliance) for specialized print partners (Blurb/Gelato).

## 4. Book Structure & Features
The book is generated as a linear sequence of `BookEntry` objects, rendered by `BookDocument.tsx`.

### A. Front Matter
-   **Cover:** Full-bleed hero image, Athlete Name, DateRange, Book title / theme.
-   **Foreword:** Optional personal note and/or inspiring quote or dedication
-   **Table of Contents:** Auto-generated; lists sections not individual pages (e.g., each month of activity journal entries is a section, not a page).

### B. The Year in Data
-   **Year Stats:** "Magazine style" dashboard. Big typography for Total Miles, Hours, Elevation.  Choose or generate an image for the background.
-   **Year Calendar:** Strava-style heatmap visualization of consistency.  See outputs/strava-streaks or outputs/strava-training for examples of how the calendar might look; but group icons into months

### C. Race Sections ( The "Hero" Content)
The heart of the book. We support dynamic variants defined in `RaceSection.tsx`:
| Variant | Pages | Use Case | Content |
| :--- | :--- | :--- | :--- |
| **Compact** | 2 | Standard Races | Hero Photo/Map (Left), Stats Grid (Right). |
| **Standard** | 4 | Key Events | Hero (1-2), Photos (3), Splits/Description (4). |
| **Full** | 6+ | "A" Races | Hero, Narrative Description, Community Kudos, Extended Photo Gallery. |
| **Minimal** | 2 | No Photos | Polyline Map (Left), Stats (Right). |

**Key Visuals:**
-   **Maps:** Mapbox Satellite style (dark mode) with bright polyline overlays.
-   **Photos:** prioritized from Strava. Future: Upload high-res override.
- **Split chart:** pre-formatted SVG
- **Elevation profile:** pre-formatted SVG

### D. Activity Log (The "Grind")
-   **Monthly Dividers:** Visually distinct chapter breaks for each active month.
-   In calendar order -- i.e., 2024-Dec is before 2025-Jan
-   A dense, journal-style tabular view of all non-race activities.
-   Preserves the record of daily training without eating up page count.

## 5. Technical Architecture
### Frontend / Rendering
-   **Framework:** Next.js (App Router).
-   **PDF Engine:** `@react-pdf/renderer`. This is non-negotiable for print control.
-   **Component Library:** specialized `react-pdf` components (`<View>`, `<Text>`, `<Image>`). *Note: HTML/CSS does not reliably facilitate print layouts.*

### Data Pipeline
-   **Strava API:** Fetch `Activities`, `Streams` (only for races), `Photos`.
-   **Computed Stats:** `computeYearSummary` calculates non-trivial metrics (e.g., "Active Days," "Fastest 5k").

### Visual & Assets
-   **Mapbox Static API:** Generates high-res (2x/4x) satellite tiles for print.
-   **Image Optimization:** `pdf-image-loader` handles fetching and buffer conversion for PDF embedding.

## 6. AI & Agentic Workflow
We employ a human-in-the-loop agentic workflow for quality assurance and polish:
-   **Visual Judge:** An LLM-based evaluator ("The Art Director") reviews generated PDFs.
-   **Auto-Fix:** "Overnight Agents" (`overnight-agents.sh`) iterate on specific templates (e.g., "Make the font hierarchy stronger on the YearStats page") until they pass the visual score threshold.

## 7. Future Roadmap
-   **Physical Fulfillment Integration:** API connection to print-on-demand services.
-   **Multi-Auth:** Importing photos from Google Photos/iCloud to supplement Strava data.
-   **Text Generation:** LLM-written race narratives based on split data (e.g., "You crushed the second half...").

---
*Reference:* See `outputs/TrainingSparkle.pdf` for the visual target.
