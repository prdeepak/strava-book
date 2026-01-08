# Automated Book Generation Test Cycle

## Overview
This document describes how to set up an automated test-iterate loop where agents:
1. Generate a test PDF
2. Analyze the output visually
3. Identify issues
4. Fix the code
5. Repeat until quality criteria are met

## Test Script

```bash
#!/bin/bash
# scripts/test-book-cycle.sh

# 1. Start the dev server if not running
if ! curl -s http://localhost:3000 > /dev/null; then
  echo "Starting dev server..."
  cd /Users/deepak/bin/strava-book/web && npm run dev &
  sleep 10
fi

# 2. Generate a test PDF (requires auth - use saved session or mock data)
# Option A: Call the preview/book endpoint
curl -o /Users/deepak/bin/strava-book/outputs/test-$(date +%Y%m%d-%H%M%S).pdf \
  "http://localhost:3000/api/generate-pdf?template=book"

# 3. Report the output file
echo "Generated: outputs/test-*.pdf"
```

## Agent Prompt for Visual QA

```
You are a visual QA agent for the Strava Book PDF generator.

## Your Task
1. Read the newest PDF in /Users/deepak/bin/strava-book/outputs/
2. Analyze each page against the expected criteria below
3. Create a list of issues found
4. For each issue, either:
   - Fix the code yourself (if straightforward)
   - Document the issue with file/line references for human review
5. Regenerate and re-test until all criteria pass

## Quality Criteria

### Cover Page
- [ ] Year is prominently displayed
- [ ] Title is readable
- [ ] Athlete name appears
- [ ] Theme colors applied (not plain black/white unless intended)

### Table of Contents
- [ ] Page numbers are correct (not all 0)
- [ ] Categories are grouped properly
- [ ] Entries match actual book content

### Year Calendar/Heatmap
- [ ] 12 months displayed
- [ ] Color legend visible
- [ ] Activity cells colored based on data
- [ ] Summary stats at bottom

### Year Stats
- [ ] Total distance, time, elevation displayed
- [ ] Numbers formatted correctly (not raw meters)
- [ ] Secondary stats grid visible

### Monthly Dividers
- [ ] Month name large and centered
- [ ] Stats (activities, distance, time) visible
- [ ] Year displayed

### Activity Log
- [ ] Table headers visible
- [ ] Activity rows populated (not empty)
- [ ] Date, name, distance, time, pace columns filled
- [ ] Mini route maps if enabled

### Back Cover
- [ ] Year stats summary
- [ ] "Strava Book" branding
- [ ] No garbled text or layout issues

## Issue Severity
- BLOCKER: Page is blank or completely broken
- MAJOR: Data missing or obviously wrong
- MINOR: Styling/spacing issues
- POLISH: Could be better but acceptable

## Output Format
After analysis, output:
1. Pass/Fail status
2. List of issues by severity
3. Recommended fixes with file:line references
4. Whether another iteration is needed
```

## Implementation Options

### Option 1: Claude Code Hook (Recommended)
Create a post-generation hook that auto-triggers QA:

```json
// .claude/settings.local.json
{
  "hooks": {
    "PostToolExecution": [
      {
        "matcher": "Bash:*generate-pdf*",
        "command": "claude -p 'Analyze newest PDF in outputs/ against QA criteria'"
      }
    ]
  }
}
```

### Option 2: Standalone QA Script
```bash
# Run full cycle
claude --print "
1. Check if web server is running (make web-dev)
2. Generate test PDF via browser/curl
3. Read the PDF from outputs/
4. Compare against QA criteria
5. Fix any issues found
6. Repeat until pass or max 5 iterations
"
```

### Option 3: GitHub Action for CI
```yaml
# .github/workflows/test-pdf.yml
name: Test PDF Generation
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
      - run: npm run test:pdf  # Custom script
      - uses: actions/upload-artifact@v4
        with:
          name: test-pdfs
          path: outputs/*.pdf
```

## Current Known Issues (for first iteration)

1. **Activity Log empty** - `BookDocument.tsx` passes empty array
   - Check: `pageActivities` calculation logic
   - File: `web/components/templates/BookDocument.tsx:196-201`

2. **Back Cover active days garbled** - Set iteration rendering issue
   - Check: How `activeDays` Set is converted to display
   - File: `web/components/templates/BackCover.tsx`

3. **Extra blank page 12** - Unknown source
   - Check: Book entry generation in curator.ts
