# A2UI Framework Evaluation for Strava Book

**Date:** January 8, 2026
**Evaluator:** Agent A
**Project:** Strava Book - PDF yearbook generator

---

## Executive Summary

**Recommendation: NO-GO**

A2UI is a promising framework for agent-driven interfaces, but it is **not a good fit** for Strava Book. The framework solves a different problem than what we face, and adoption would add complexity without meaningful benefits.

---

## What is A2UI?

A2UI (Agent-to-User Interface) is a declarative UI protocol released by Google in December 2025 (v0.8 Public Preview). It enables AI agents to generate rich, interactive UIs that render natively across platforms.

### Core Concepts

1. **Declarative JSON Protocol**: Agents output JSON describing UI intent, not executable code
2. **Component Catalog**: Clients maintain a registry of trusted, pre-approved components (Button, Card, TextField, etc.)
3. **Security First**: No arbitrary code execution; agents can only reference cataloged components
4. **Framework Agnostic**: Same JSON payload renders on React, Flutter, Angular, SwiftUI
5. **Streaming Support**: JSONL/SSE for progressive rendering

### Message Types

```json
// surfaceUpdate - defines UI structure
{"surfaceUpdate": {"surfaceId": "booking", "components": [
  {"id": "title", "component": {"Text": {"text": {"literalString": "Book Your Table"}}}},
  {"id": "submit-btn", "component": {"Button": {"child": "submit-text", "action": {"name": "confirm"}}}}
]}}

// dataModelUpdate - updates bound data
{"dataModelUpdate": {"surfaceId": "booking", "contents": [
  {"key": "date", "valueString": "2025-12-16T19:00:00Z"}
]}}

// beginRendering - signals client to render
{"beginRendering": {"surfaceId": "booking", "root": "title"}}
```

### Current Status

- Version: 0.8 (Public Preview)
- License: Apache 2.0
- Renderers: Lit (Web Components), Angular, Flutter
- React Renderer: Proposed but not yet shipped (ByteDance working on it)
- GitHub: https://github.com/google/A2UI

---

## Evaluation Against Adoption Criteria

### Criterion 1: Better Safety Boundaries for AI-Generated Content

**Result: NOT APPLICABLE**

| A2UI Approach | Our Approach |
|---------------|--------------|
| AI generates JSON referencing pre-approved UI components | AI generates JSON design spec for PDF layout |
| Prevents arbitrary code execution in browser | PDF rendered server-side with @react-pdf/renderer |
| Component catalog limits what agent can create | We already parse AI output as JSON, not code |

**Analysis:** Our current architecture already has strong safety boundaries:
- AI returns JSON design specs, not executable code
- `parseGeminiResponse()` validates and extracts data
- PDF rendering happens server-side with fixed templates
- No client-side code execution from AI output

A2UI's security model is designed to prevent browser-side attacks (XSS, UI injection). Our PDF generation is server-side with no such attack surface.

### Criterion 2: Cleaner Multi-Agent Coordination

**Result: NO BENEFIT**

| A2UI Approach | Our Current Approach |
|---------------|---------------------|
| Single agent generates UI components | Multi-step: Mockup API -> AI Generate -> PDF Render |
| Surfaces for different UI areas | Sequential API calls with state in frontend |
| dataModelUpdate for reactive binding | React state management in modals |

**Analysis:** A2UI doesn't provide multi-agent coordination patterns. It's about agent-to-client communication, not agent-to-agent. Our current flow:

```
User Config -> /api/generate-mockup (layout description)
           -> /api/ai-generate (design spec JSON)
           -> /api/generate-pdf (React-PDF rendering)
```

This sequential pipeline doesn't benefit from A2UI's streaming model because:
1. Each step depends on the previous step's output
2. PDF generation is a batch operation, not progressive
3. Our "agents" are really prompt templates, not autonomous agents

### Criterion 3: Better UX for Progress Visibility and User Intervention

**Result: MARGINAL BENEFIT, HIGH COST**

| A2UI Approach | Our Current Approach |
|---------------|---------------------|
| Streaming components via JSONL/SSE | Loading states with setTimeout fallback |
| Progressive rendering | Full result after completion |
| surfaceUpdate for incremental changes | Re-render modal on state change |

**Potential Benefit:** A2UI could enable:
- Streaming progress updates during AI generation
- Step-by-step visualization of design choices
- User intervention mid-generation

**Reality Check:**
1. **No React Renderer**: We'd need to build one or use Lit web components
2. **Architecture Mismatch**: Our UI is React 19, A2UI has Lit/Angular renderers
3. **Existing Pattern Works**: Current loading states + "Continue Offline" pattern handles long operations
4. **PDF is Final Output**: Users care about the PDF, not intermediate UI states

### Criterion 4: Higher Quality Output

**Result: NO BENEFIT**

A2UI is a transport/rendering protocol, not an AI quality framework. Output quality depends on:
- Prompt engineering (we do this already)
- Model selection (Gemini 2.0 Flash)
- Post-processing (JSON parsing, validation)

A2UI doesn't improve any of these.

---

## Technical Blockers

### 1. No React Renderer (Critical)

Our stack is Next.js 16 with React 19. A2UI currently supports:
- Lit (Web Components)
- Angular
- Flutter

ByteDance has proposed a React renderer (GitHub issue #347), but it's not shipped. Using A2UI would require:
- Building a custom React renderer, OR
- Mixing Lit web components into our React app, OR
- Waiting for official React support

**Estimated Effort:** 2-4 weeks for custom renderer

### 2. Protocol Mismatch

A2UI is designed for:
- Interactive, streaming interfaces
- Real-time agent-driven UI updates
- Browser-rendered components

Our use case:
- Server-side PDF generation
- Batch processing (activity data -> PDF)
- Static output (PDFs don't update)

### 3. Component Catalog Doesn't Map

A2UI components: Button, TextField, Card, DateTimeInput, etc.

Our needs: PDF layout primitives (Text, View, Image, Page, Document)

We'd need to build a parallel component system that doesn't leverage A2UI's security benefits.

---

## Alternative: Improve Existing Patterns

Instead of A2UI, we recommend enhancing current architecture:

### 1. Add Server-Sent Events for Progress

```typescript
// web/app/api/ai-generate-stream/route.ts
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode('data: {"step": "analyzing"}\n\n'));
      // ... Gemini call
      controller.enqueue(encoder.encode('data: {"step": "generating"}\n\n'));
      // ... result
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(result)}\n\n`));
      controller.close();
    }
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' }});
}
```

### 2. Structured Progress Updates

```typescript
// In AIGenerationModal.tsx
const [progress, setProgress] = useState<'idle' | 'fetching' | 'analyzing' | 'generating' | 'rendering'>('idle');

// Display step-by-step progress without A2UI
{progress === 'analyzing' && <ProgressStep text="Analyzing activity data..." />}
{progress === 'generating' && <ProgressStep text="Generating design..." />}
```

### 3. JSON Schema Validation

```typescript
// Add zod or ajv validation for AI responses
import { z } from 'zod';

const DesignSpecSchema = z.object({
  fonts: z.object({...}),
  colorScheme: z.object({...}),
  bodyElements: z.array(...)
});

// Validate AI output before using
const validated = DesignSpecSchema.parse(aiResult);
```

---

## Summary Table

| Criterion | A2UI Benefit | Our Need | Fit |
|-----------|-------------|----------|-----|
| Safety boundaries | Prevents browser attacks | Server-side PDF, already safe | NO |
| Multi-agent coordination | Not provided | Not critical | NO |
| Progress visibility | Streaming UI | Could use SSE instead | MARGINAL |
| Output quality | None | N/A | NO |
| React support | Not available | Required | BLOCKER |
| Complexity cost | High | Should be low | NEGATIVE |

---

## Conclusion

A2UI is an innovative framework for a specific problem: safely rendering agent-generated interactive UIs in browsers. Strava Book generates static PDFs server-side. The architectural mismatch, combined with missing React support and high integration cost, makes A2UI the wrong tool for this project.

**Recommended Action:** Continue with existing patterns. Add SSE for progress visibility if needed. Monitor A2UI for future consideration when:
1. Official React renderer ships
2. Project needs shift toward interactive agent UIs
3. Real-time AI-driven interfaces become a requirement

---

## References

- [A2UI Official Site](https://a2ui.org/)
- [A2UI GitHub](https://github.com/google/A2UI)
- [Google Developers Blog - Introducing A2UI](https://developers.googleblog.com/introducing-a2ui-an-open-project-for-agent-driven-interfaces/)
- [A2UI Specification v0.8](https://a2ui.org/specification/v0.8-a2ui/)
- [React Renderer Proposal (Issue #347)](https://github.com/google/A2UI/issues/347)
