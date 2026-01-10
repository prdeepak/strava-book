#!/bin/bash
# overnight-agents.sh
# Run 12 parallel agents to improve strava-book templates and graphics
# Usage: ./overnight-agents.sh

cd /Users/deepak/bin/strava-book

echo "Starting overnight agents at $(date)"

# Stream A: Template Polish (8 agents)
# Each agent iterates until visual judge score >= 80, then commits

claude "You are Agent A1. Task: Improve Cover.tsx template visual quality.
Read AGENT_INSTRUCTIONS.md for workflow.
Test command: make test-template template=Cover fixture=race_marathon
Goals: Score >= 80, premium coffee-table book-quality feel. Generate image(s) if needed, or choose one from the fixtures
Iterate until passing (max 10 iterations).
On success, commit with message: Polish Cover: score {N}
" &

claude "You are Agent A2. Task: Improve YearStats.tsx template visual quality.
Read AGENT_INSTRUCTIONS.md for workflow.
Test command: make test-template template=YearStats fixture=activeYear
Goals: Score >= 80, large hero numbers, magazine-style stats, good typography hierarchy. Should include graphs by month for distance, elevation, and time.
Reference: outputs/TrainingSparkle book (shrunk).pdf
Iterate until passing (max 10 iterations).
On success, commit with message: Polish YearStats: score {N}
" &

claude "You are Agent A3. Task: Improve YearCalendar.tsx template visual quality.
Read AGENT_INSTRUCTIONS.md for workflow.
Test command: make test-template template=YearCalendar fixture=activeYear
Goals: Score >= 80, clean heatmap grid.
Reference: outputs/Strava streaks.png and/or Strava training log.png for inspiration.
Iterate until passing (max 10 iterations).
On success, commit with message: Polish YearCalendar: score {N}
" &

claude "You are Agent A4. Task: Improve Race_1p.tsx template visual quality.
Read AGENT_INSTRUCTIONS.md for workflow.
Test command: make test-template template=Race_1p fixture=race_marathon
Goals: Score >= 80, hero race page with impact, good photo integration.
Reference: outputs/TrainingSparkle book (shrunk).pdf
Iterate until passing (max 10 iterations).
On success, commit with message: Polish Race_1p: score {N}
" &

claude "You are Agent A5. Task: Improve Race_2p.tsx template visual quality (includes Left + Right).
Read AGENT_INSTRUCTIONS.md for workflow.
Files: Race_2p.tsx, Race_2pLeft.tsx, Race_2pRight.tsx
Test command: make test-template template=Race_2p fixture=race_ultramarathon
Goals: Score >= 80, cohesive spread. Left: hero photo + title. Right: map + stats + splits.
Iterate until passing (max 10 iterations).
On success, commit with message: Polish Race_2p: score {N}
" &

claude "You are Agent A6. Task: Improve ActivityLog.tsx template visual quality.
Read AGENT_INSTRUCTIONS.md for workflow.
Test command: make test-template template=ActivityLog fixture=activeYear
Goals: Score >= 80, clean scannable rows, good density without feeling cramped.
Iterate until passing (max 10 iterations).
On success, commit with message: Polish ActivityLog: score {N}
" &

claude "You are Agent A7. Task: Improve MonthlyDivider.tsx template visual quality.
Read AGENT_INSTRUCTIONS.md for workflow.
Test command: make test-template template=MonthlyDivider fixture=activeYear
Goals: Score >= 80, bold month name, summary stats, dynamic feel.
Iterate until passing (max 10 iterations).
On success, commit with message: Polish MonthlyDivider: score {N}
" &

claude "You are Agent A8. Task: Improve BackCover.tsx template visual quality.
Read AGENT_INSTRUCTIONS.md for workflow.
Test command: make test-template template=BackCover fixture=activeYear
Goals: Score >= 80, clean closing with final stats, professional branding.
Iterate until passing (max 10 iterations).
On success, commit with message: Polish BackCover: score {N}
" &

# Stream B: Graphics Generation (4 agents)
# Each agent improves a visualization component

claude "You are Agent B1. Task: Improve splits chart SVG generation.
Search codebase for SplitsChart, splits-chart, or similar.
Goals: Generate cleaner SVG or PNG, remove elevation overlay if cluttered, scale well at different sizes, handle edge cases.
Test by generating a PDF with splits and reviewing visually.
On success, commit with message: Improve splits chart generation
" &

claude "You are Agent B2. Task: Improve elevation profile visualization.
Search for 'elevation' in web/lib/ and web/components/.
Goals: Clean SVG elevation chart, works at small sizes (ActivityLog) and large sizes (Race pages).
On success, commit with message: Improve elevation profile visualization
" &

claude "You are Agent B3. Task: Improve route map generation for PDFs.
Search for 'mapbox' or 'polyline' in codebase.
Goals: High-quality static map images using Mapbox Static API, handle missing GPS gracefully.
On success, commit with message: Improve route map generation
" &

claude "You are Agent B4. Task: Create/improve year heatmap visualization.
File: web/components/templates/YearCalendar.tsx and web/lib/ if needed.
Goals: GitHub contribution-style heatmap, color intensity by distance/time, clean SVG output.
On success, commit with message: Improve year heatmap visualization
" &

echo "12 agents launched at $(date)"
echo "Waiting for all agents to complete..."
wait
echo "All agents complete at $(date)"

# Post-run validation
echo ""
echo "=== Running integration tests ==="
make test-integration-quick

echo ""
echo "=== Recent commits ==="
git log --oneline -15

echo ""
echo "=== Check test-output/ for generated PDFs ==="
ls -la test-output/
