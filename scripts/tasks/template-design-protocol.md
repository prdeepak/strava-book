# Task: Create {{VARIANT_NAME}} Race Section Variant

## Overview

Create a new race section variant `{{VARIANT_NAME}}` (component: `RaceSection{{PASCAL_NAME}}`) based on the reference design image. Follow the staged process below, completing each gate before proceeding.

**Reference image:** `reference-design.png` (in workspace root)

---

## Stage 1: Layout Decomposition

Analyze `reference-design.png` and write `LAYOUT.md` with:

1. **Page-by-page plan** — For each page:
   - Page number and role (hero, description, stats, photos, map, comments)
   - Primary content (what dominates the page)
   - Secondary content (supporting elements)
   - Estimated fill ratio

2. **Spread pairing** — Which pages form left-right spreads:
   - Pages 1+2, 3+4, etc.
   - Visual balance assessment per spread

3. **Primitive reuse** — Which existing primitives to use:
   - `FullBleedBackground` — `web/components/pdf/FullBleedBackground.tsx`
   - `PdfImage` / `PdfImageCollection` — `web/components/pdf/PdfImage.tsx`
   - `AutoResizingPdfText` — `web/components/pdf/AutoResizingPdfText.tsx`
   - `PageHeader` — `web/components/pdf/PageHeader.tsx`
   - `StatRow` / `StatGrid` — `web/components/pdf/StatComponents.tsx`

4. **Closest existing variant** — Read 2-3 existing variants for structural reference:
   - `web/components/templates/RaceSectionEditorial.tsx`
   - `web/components/templates/RaceSectionMagazine.tsx`
   - `web/components/templates/RaceSection.tsx` (renderDefaultPages)

**Gate:** `LAYOUT.md` must exist before proceeding to Stage 2.

---

## Stage 1.5: Layout Review

Launch a separate Claude reviewer to validate the layout:

```bash
claude --dangerously-skip-permissions -p "You are a layout reviewer for a PDF race section template. \
  Read reference-design.png (the target design) and LAYOUT.md (the proposed page structure). \
  Also read these existing variants for pattern reference: \
    web/components/templates/RaceSectionEditorial.tsx \
    web/components/templates/RaceSectionMagazine.tsx \
    web/components/templates/RaceSection.tsx (renderDefaultPages) \
  And read docs/StyleGuide.md for design system rules. \
  Evaluate: \
    1. Does LAYOUT.md accurately decompose the reference image into the right number of pages? \
    2. Is the content assignment per page correct (hero content, secondary content)? \
    3. Are the chosen primitives appropriate (PdfImage vs PdfImageCollection, FullBleedBackground usage)? \
    4. Do the spread pairings make visual sense (left+right page balance)? \
    5. Are there existing patterns in the reference variants that should be reused? \
  Output ONLY a JSON object: {\"approved\": boolean, \"issues\": [string], \"suggestions\": [string]}. \
  Be strict — reject if page count, content assignment, or primitive choices are clearly wrong."
```

**Review loop:**
- If not approved: revise LAYOUT.md based on issues, re-submit. **Max 2 review cycles.**
- If still not approved after 2 cycles: proceed anyway but log concerns in LAYOUT.md under a `## Review Concerns` section.

---

## Stage 2: Full-Data Implementation

### 2a. Create the variant component

Create `web/components/templates/RaceSection{{PASCAL_NAME}}.tsx`:

- **Props interface** — exactly 5 props:
  ```typescript
  interface RaceSection{{PASCAL_NAME}}Props {
    activity: StravaActivity
    format: BookFormat
    theme: BookTheme
    mapboxToken: string
    highlightLabel?: string
  }
  ```

- **Standard structure:**
  1. `createStyles(format, theme)` — returns StyleSheet
  2. Page sub-components (one per page from LAYOUT.md)
  3. Main `{{PASCAL_NAME}}Pages` export returning `<>` fragment with conditional pages

- **Follow patterns from** the closest existing variant identified in LAYOUT.md.

### 2b. Register in 4 locations

1. **`web/lib/book-types.ts`** — Add `'{{VARIANT_NAME}}'` to `RaceSectionVariant` union type
2. **`web/components/templates/RaceSection.tsx`** — Add import + case to `renderPages()` switch
3. **`web/lib/testing/section-manifest.ts`** — Add `build{{PASCAL_NAME}}Manifest()` function + case to switch
4. **`web/components/templates/BookDocument.tsx`** — Add to `pageCounts` record AND round-robin pool in `selectRaceVariants()`

### 2c. Style Guide Compliance Checklist

Self-verify before proceeding:

- [ ] `padding: 0` on Page, content in absolutely-positioned contentContainer with safeMargin
- [ ] All colors from `theme.*` tokens (no hex literals)
- [ ] All fonts from `resolveTypography()` (no hardcoded font names)
- [ ] All spacing from `resolveSpacing()` (no hardcoded multipliers)
- [ ] Photos via `extractPhotos()` + `PdfImage`/`PdfImageCollection`
- [ ] Display-sized text wrapped in `AutoResizingPdfText`
- [ ] Effects via `resolveEffects()`
- [ ] `make web-check` passes with 0 errors

### 2d. Manifest Accuracy Gate

Run manifest validation to confirm predicted page count matches actual:

```bash
npx tsx web/lib/testing/design-iteration.ts --variant {{VARIANT_NAME}} --profile full-data --validate-manifest
```

**Gate:** Manifest prediction must exactly match rendered page count before proceeding.

---

## Stage 3: Full-Data Design Loop (max 5 iterations)

### Iteration loop:

1. **Render** variant with full-data fixture:
   ```bash
   npx tsx web/lib/testing/variant-test-runner.ts \
     --variants {{VARIANT_NAME}} --profiles full-data --verbose
   ```

2. **Visual comparison** — Read rendered PNGs and compare against `reference-design.png`:
   - Page count match
   - Content placement similarity
   - Visual hierarchy alignment

3. **Evaluate** — Check heuristic judge scores:
   - Overall score >= 60
   - All 4 criteria >= 40
   - If failing: read issues/suggestions, fix template code

4. **Re-validate manifest** after any code changes:
   ```bash
   npx tsx web/lib/testing/design-iteration.ts --variant {{VARIANT_NAME}} --profile full-data --validate-manifest
   ```

5. **Re-render** and re-evaluate

**Exit conditions:**
- All criteria passing (overall >= 60, each >= 40) → proceed to Stage 4
- 5 iterations without convergence → document blockers in `STUCK.md`, proceed to Stage 4

---

## Stage 4: Degradation Design (max 3 iterations per failing profile)

### 4a. Run full profile matrix

```bash
npx tsx web/lib/testing/variant-test-runner.ts \
  --variants {{VARIANT_NAME}} --verbose
```

### 4b. Fix failing profiles

For each failing profile, apply degradation principles:

- **Skip, don't empty** — If a page's primary content is missing, skip the entire page
- **Merge short pages** — If two adjacent pages are each <50% utilized, consolidate
- **Evaluate length, not existence** — A 20-char description doesn't deserve a full page
- **No placeholders** — Never render "No photos available" or empty grids
- **Page count formula** — `max(1, pages_with_sufficient_content)`
- **Spread awareness** — When removing a page, consider whether remaining pages form balanced spreads

### 4c. After fixing conditional rendering

1. Update manifest builder (`build{{PASCAL_NAME}}Manifest()`) to match new conditional logic
2. Run manifest validation across ALL profiles:
   ```bash
   npx tsx web/lib/testing/design-iteration.ts --variant {{VARIANT_NAME}} --all-profiles --validate-manifest
   ```
3. Re-run variant test runner for the failing profile
4. Max 3 iterations per profile

### 4d. Final matrix check

After all profiles addressed, run full matrix to confirm no regressions:

```bash
npx tsx web/lib/testing/variant-test-runner.ts \
  --variants {{VARIANT_NAME}} --verbose
```

---

## Stage 5: Final Validation + PR

### 5a. Full validation suite

```bash
# Lint + build
make web-check

# All e2e tests
make test-e2e-ci

# Full variant test matrix
npx tsx web/lib/testing/variant-test-runner.ts \
  --variants {{VARIANT_NAME}} --verbose
```

### 5b. Create PR

```bash
gh pr create \
  --title "feat: Add {{VARIANT_NAME}} race section variant" \
  --body "$(cat <<'EOF'
## Summary
- New race section variant: `{{VARIANT_NAME}}` (`RaceSection{{PASCAL_NAME}}`)
- Layout decomposition from reference design
- Full degradation support across all 14 data profiles

## Layout
[Paste LAYOUT.md summary here]

## Score Matrix
[Paste variant test runner matrix here — 14 profiles x 4 criteria]

## Judge Feedback Summary
[Paste worst cases and suggestions]

## Validation
- [x] `make web-check` passes
- [x] `make test-e2e-ci` passes
- [x] All 14 profiles pass heuristic judge
- [x] Manifest predictions match actual page counts

Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Reference Files

| File | Purpose |
|------|---------|
| `docs/StyleGuide.md` | Design system rules — read before writing any template |
| `web/lib/book-types.ts` | Types: `BookFormat`, `BookTheme`, `RaceSectionVariant` |
| `web/lib/typography.ts` | `resolveTypography()`, `resolveSpacing()`, `resolveEffects()` |
| `web/lib/photo-gallery-utils.ts` | `extractPhotos()` for photo extraction |
| `web/components/pdf/` | Reusable PDF primitives |
| `web/components/templates/RaceSection*.tsx` | Existing variant implementations |
| `web/lib/testing/section-manifest.ts` | Manifest builder to mirror |
| `web/lib/testing/fixture-factory.ts` | `getBaseFixture()`, `applyDataProfile()`, `PRESETS` |
| `web/lib/testing/design-iteration.ts` | Design iteration CLI tool |
| `web/lib/testing/variant-test-runner.ts` | Variant test orchestrator |
