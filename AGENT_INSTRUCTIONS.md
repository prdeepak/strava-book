# Agent Instructions for Template Development

This document describes how autonomous agents should iterate on PDF templates.

## Test Infrastructure

### Quick Reference

```bash
# List available templates and fixtures
make test-list

# Test a specific template
make test-template template=Race_1p fixture=race_marathon

# Generate PDF only (no LLM evaluation)
make test-pdf template=Race_1p fixture=race_marathon

# Run all tests
make test-visual
```

### Output Location

- PDFs: `test-output/<template>-<fixture>.pdf`
- Images: `test-output/<template>-<fixture>-*.png`
- Report: `test-output/report.md`

## Iteration Loop

When developing a template, follow this cycle:

1. **Make changes** to the template file in `web/components/templates/`

2. **Generate and test**:
   ```bash
   make test-template template=<TemplateName> fixture=<fixture_name>
   ```

3. **Read the feedback** from stdout or `test-output/report.md`

4. **If FAIL**: Address the issues listed in `suggestions`, then repeat from step 1

5. **If PASS** (score >= 70, no criterion below 50): Move to next fixture/template

## Evaluation Criteria

The visual judge scores on three criteria (0-100 each):

### Print Readability (33%)
- Body text >= 10pt at print size
- Sufficient contrast (text vs background)
- Critical content within safe margins
- Text clearly separated from images

### Layout Balance (33%)
- Visual weight distributed across page
- Appropriate whitespace
- Consistent alignment
- Images properly sized/positioned

### Brand Cohesion (33%)
- Colors match theme palette
- Fonts used consistently
- Spacing rhythm consistent
- Professional print publication quality

**Pass threshold**: Overall >= 70, no single criterion below 50

## Available Fixtures

### Races
- `race_ultramarathon` - Comrades 2025 (91km, 5 photos, 16 comments)
- `race_marathon` - Toronto Marathon (42km)
- `race_half_marathon` - Around the Bay 30km

### Training
- `training_long_run` - "Comrades pace" dry run (35km, 4 photos, 3 comments)
- `training_tempo` - 5km steady run (2 photos)
- `training_easy` - Gentle 5k by the Tiber (3 photos, 5 comments)

### Other
- `other_workout` - Strength workout (2 comments)
- `other_swim` - Morning swim
- `other_ride` - Sprint tri bike segment
- `other_walk` - Anniversary hike (5 photos)
- `other_hike` - Wandering through Rome (8 photos)

### Edge Cases
- `edge_no_gps` - Run without GPS data
- `edge_very_long` - Comrades ultra (11+ hours)
- `edge_very_short` - 15-minute mobility session
- `edge_high_elevation` - High elevation gain activity

### Rich Content
- `rich_full_content` - Activity with photos, comments, and description

## Template Structure

Each template should:

1. **Accept props**: `{ activity, format?, theme? }`
2. **Handle missing data**: Don't crash on null photos/splits/etc.
3. **Scale with format**: Use `format.scaleFactor` for typography
4. **Respect safe margins**: Keep content inside `format.safeMargin`

## Design Reference

See `outputs/TrainingSparkle book (shrunk).pdf` for design inspiration:
- Bold typography hierarchy
- Photo-driven layouts
- Clean stats presentation
- Professional print quality

## Troubleshooting

### "pdftoppm not found"
Install poppler for PDF-to-image conversion:
```bash
brew install poppler
```

### LLM Judge Errors
The judge tries providers in order: Bedrock → Gemini → Anthropic
Check `.env.local` for API keys if all fail.

### Template Not Found
Ensure template is registered in `web/lib/testing/test-harness.ts` templateRegistry.
