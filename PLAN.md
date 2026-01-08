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

### 4.0 Template Specification System (NEW)

Create a structured specification for each template that the AI Designer can use.

#### Input Specification (what material is available)
Each template declares its available inputs:
```typescript
interface TemplateInputSpec {
  templateId: string  // e.g., 'race_1p', 'year_stats', 'monthly_divider'

  // Available data sources
  availableInputs: {
    activity?: StravaActivity           // Core activity data
    photos: PhotoData[]                 // User's activity photos
    prebuiltGraphics: {                 // Pre-generated visualizations
      splitsChart?: string              // SVG or image URL
      elevationProfile?: string
      routeMap?: string
      paceHeatmap?: string
    }
    stats: StatBlock[]                  // Key metrics to display
    textContent: {                      // Text options
      title: string
      subtitle?: string
      description?: string
      narrative?: string                // AI-generated story
      pullQuotes?: string[]             // Highlight phrases
    }
  }
}
```

#### Output Specification (layout choices)
AI chooses from predefined layout variants (3-5 per template):
```typescript
interface TemplateOutputSpec {
  layoutVariant: string   // e.g., 'title-top', 'title-bottom', 'hero-left'

  // Layout options within the variant
  options: {
    titlePosition: 'top' | 'bottom' | 'overlay'
    alignment: 'left' | 'center' | 'right'
    photoTreatment: 'full-bleed' | 'inset' | 'grid' | 'collage'
  }

  // Background selection
  background: {
    type: 'solid' | 'gradient' | 'photo-fade' | 'ai-generated'
    color?: string
    photoIndex?: number         // Which user photo to use as background
    opacity?: number            // For photo backgrounds
  }

  // Optional AI-generated content
  generatedContent?: {
    narrative?: string          // AI-written text
    graphics?: GeneratedGraphic[] // SVG patterns, decorations
    images?: GeneratedImage[]    // AI image generation (future)
  }
}

interface GeneratedGraphic {
  type: 'pattern' | 'decoration' | 'chart-enhancement'
  svg: string                   // SVG markup
  position: 'background' | 'accent' | 'border'
}
```

#### Layout Guidelines (rules for AI)
Each template includes guidelines for the AI Designer:
```typescript
interface TemplateGuidelines {
  templateId: string

  // When to choose this template
  selectionCriteria: string[]   // e.g., ["Race with 5+ photos", "High kudos count"]

  // Layout variant guidance
  variantGuidelines: {
    [variantName: string]: {
      bestFor: string           // "Activities with dramatic hero photo"
      avoid: string             // "Low-quality or indoor photos"
      photoRequirements: string // "Needs at least 1 landscape photo"
    }
  }

  // Content priorities
  contentPriority: string[]     // Ordered list: ["hero-photo", "stats", "splits-chart"]

  // Style constraints
  constraints: {
    maxPhotos: number
    requiresMap: boolean
    minTextLength?: number
  }
}
```

#### Implementation Tasks
- [ ] Create `web/lib/template-specs/` directory
- [ ] Define specs for existing templates: Race_1p, Race_2p, Cover, YearStats, etc.
- [ ] Create `TemplateRegistry` that maps templateId → spec + component
- [ ] Update Designer Agent to read specs and make informed layout choices
- [ ] Pre-generate graphics (charts, maps) before passing to AI

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

### Agent Hierarchy with Template Specs
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
│ Pre-Generation Step (NEW)                    │
│ - Generate splits charts, maps, heatmaps    │
│ - Prepare photo options with metadata       │
│ - Build TemplateInputSpec for each page     │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Designer Agent (Page Level)                  │
│ INPUT: TemplateInputSpec + Guidelines        │
│ - Reads available inputs and layout variants │
│ - Chooses layout variant (e.g., 'hero-left')│
│ - Selects photos, background, alignment     │
│ - Optionally generates narrative/graphics   │
│ OUTPUT: TemplateOutputSpec                   │
│ - Self-corrects via visual-judge feedback    │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Renderer                                     │
│ - Maps TemplateOutputSpec → React component │
│ - Applies layout variant + options          │
│ - Generates final PDF page                  │
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
| `web/lib/template-specs/` | Template input/output specs + guidelines (NEW) |
| `web/lib/template-specs/registry.ts` | Maps templateId → spec + component (NEW) |
| `web/lib/ai-book-designer.ts` | Core agent logic |
| `web/app/api/ai-book-designer/` | API routes |
| `web/components/AIBookDesignerModal.tsx` | UI component |
| `web/lib/testing/visual-judge.ts` | Book-level scoring |
| `web/lib/ai-validation.ts` | AI output validation |

---

## Verification Checklist

- [ ] `make test-e2e-ci` passes (28 tests)
- [ ] Template specs defined for all major templates (Race_1p, Race_2p, Cover, YearStats, etc.)
- [ ] Designer Agent reads TemplateInputSpec and outputs valid TemplateOutputSpec
- [ ] Pre-generation step creates charts/maps before AI design phase
- [ ] AI Book Designer generates valid book specs
- [ ] Self-correction loop improves scores over iterations
- [ ] Full book PDF generates without errors
- [ ] End-to-end: User clicks "AI Design" → sees progress → downloads PDF
- [ ] Generated book scores ≥70 on visual judge
