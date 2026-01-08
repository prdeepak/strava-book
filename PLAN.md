# AI Book Designer Implementation Plan

**Goal:** Build an AI Book Designer that orchestrates book generation with self-correcting loops

---

## Progress Summary

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: A2UI Research | ✅ Complete | See `web/lib/a2ui/EVALUATION.md` |
| Phase 2: Test Infrastructure | ✅ Complete | Playwright e2e, visual-judge, AI validation |
| Phase 3: AI Book Designer Agents | ✅ Infrastructure built | Agents created, not yet wired to UI |
| Phase 4: Integration & Polish | 🔲 Not started | See next steps below |

---

## What's Built

### Test Infrastructure
- `make test-e2e-ci` - Self-contained e2e tests (fully isolated, no manual setup)
- `make test-e2e` - E2e tests against running dev server
- Book-level visual judging in `web/lib/testing/visual-judge.ts`
- AI output validation in `web/lib/ai-validation.ts`

### AI Book Designer Core
- `web/lib/ai-book-designer.ts` - Three-agent hierarchy:
  ```
  Art Director (Global) → Narrator (Chapter) → Designer (Page)
  ```
- `web/app/api/ai-book-designer/start/route.ts` - Start design session
- `web/app/api/ai-book-designer/status/[sessionId]/route.ts` - Check progress
- `web/components/AIBookDesignerModal.tsx` - UI component (not wired up)

---

## Next Steps (Phase 4)

### 4.1 Wire to Builder UI
- [ ] Add "AI Design Book" button to BookGenerationModal
- [ ] Import and render AIBookDesignerModal in BuilderClient
- [ ] Connect button click to open AIBookDesignerModal
- [ ] Pass selected activities and date range to modal

### 4.2 Agent Progress UI
- [ ] Show pipeline stages: Art Director → Narrator → Designer
- [ ] Real-time status updates via polling `/api/ai-book-designer/status`
- [ ] Display AI reasoning/decisions at each stage
- [ ] Allow user to cancel mid-process

### 4.3 Preview & Approval
- [ ] Show book preview before PDF generation
- [ ] Display theme colors, font choices, page count
- [ ] "Approve" button to proceed to PDF generation
- [ ] "Regenerate" button to try again with different parameters

### 4.4 Error Handling
- [ ] Graceful degradation if AI fails (fall back to preset theme)
- [ ] User can override any AI decision
- [ ] Save/resume design sessions (optional)

### 4.5 End-to-End Testing
- [ ] Test with real Gemini API (USE_REAL_AI=true)
- [ ] Verify self-correction loop improves scores
- [ ] Target: generated book scores ≥70 on visual judge
- [ ] Add e2e test for full AI design flow

---

## Architecture Reference

### Agent Hierarchy
```
┌─────────────────────────────────────────────┐
│ Art Director Agent (Global)                  │
│ - Analyzes A Race + top photos               │
│ - Generates Global Style Guide               │
│ - Output: BookTheme + narrative arc          │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Narrator Agent (Chapter Level)               │
│ - Groups activities into chapters            │
│ - Generates section summaries                │
│ - Selects highlight activities               │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Designer Agent (Page Level)                  │
│ - Selects template variant per page          │
│ - Customizes within constraints              │
│ - Self-corrects via visual-judge feedback    │
└─────────────────────────────────────────────┘
```

### Self-Correction Loop
```typescript
async function designPageWithFeedback(
  page: PageSpec,
  theme: BookTheme,
  maxIterations = 3
): Promise<DesignSpec> {
  let design = await generateDesign(page, theme)

  for (let i = 0; i < maxIterations; i++) {
    const judgment = await judgeDesign(design)
    if (judgment.pass) return design

    design = await improveDesign(design, judgment.suggestions)
  }

  return design // Best effort after max iterations
}
```

### Key Files
| File | Purpose |
|------|---------|
| `web/lib/ai-book-designer.ts` | Core agent logic |
| `web/app/api/ai-book-designer/` | API routes |
| `web/components/AIBookDesignerModal.tsx` | UI component |
| `web/lib/testing/visual-judge.ts` | Book-level scoring |
| `web/lib/ai-validation.ts` | AI output validation |

---

## Verification Checklist

- [ ] `make test-e2e-ci` passes (28 tests)
- [ ] AI Book Designer generates valid book specs
- [ ] Self-correction loop improves scores over iterations
- [ ] Full book PDF generates without errors
- [ ] End-to-end: User clicks "AI Design" → sees progress → downloads PDF
- [ ] Generated book scores ≥70 on visual judge
