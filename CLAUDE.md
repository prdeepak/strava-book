# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Strava Book is a web application that generates print-ready PDF "coffee table books" from Strava activity data. Users authenticate with Strava, curate activities, select templates, and generate publication-quality PDFs.

**Tech Stack:** Next.js 16 (React 19), TypeScript, Tailwind CSS 4, @react-pdf/renderer, NextAuth.js, Google Gemini AI, Mapbox

## Development Commands

All commands should use the Makefile. Never run Python scripts directly on the host.

```bash
make start-work    # Start Docker + web dev server (daily workflow)
make web-dev       # Start Next.js dev server (port 3000)
make web-check     # Run lint + build
make test          # Run pytest inside Docker container
make sync msg="..."  # Commit & push (always confirm message with user first)
```

## Git Sync Protocol

When user says "Sync", "Save", or "Push":
1. Run `git status` and `git diff --stat`
2. Propose a concise commit message
3. **STOP and wait for user confirmation**
4. Once confirmed: `make sync msg="<message>"`

## Architecture

### Data Flow
1. `/` → Strava OAuth via NextAuth
2. `/builder` → Fetches 200 recent activities, displays in BuilderClient
3. User selects activity → Opens PDFGenerationModal or AIGenerationModal
4. Modal fetches comprehensive data from `/api/comprehensive-activity-data`
5. User configures template → POST to `/api/generate-pdf` or `/api/ai-generate`
6. Backend renders React-PDF component → returns binary PDF

### Key Directories
```
web/
├── app/                    # Next.js routes
│   ├── builder/           # Main app page (activity curation)
│   ├── preview/           # Template preview routes
│   └── api/               # Backend endpoints
├── components/
│   ├── BuilderClient.tsx  # Main UI (activity list, filtering)
│   ├── PDFGenerationModal.tsx  # Template selection & config
│   ├── AIGenerationModal.tsx   # AI-powered design workflow
│   ├── templates/         # PDF page templates (React-PDF)
│   └── pdf/               # Reusable PDF components
└── lib/
    ├── strava.ts          # Strava API client
    ├── activity-utils.ts  # Location resolution, geocoding
    └── curator.ts         # Smart draft generation
```

### Component Patterns
- **Client Components** (`'use client'`): BuilderClient, modals (interactive state)
- **Server Components**: /builder page, API routes (auth, Strava calls)
- **Templates**: Pure data rendering, PDF-specific (Race_1p, Race_2p, AIRace)
- **PDF Components**: Reusable React-PDF views (Header, StatsGrid, CommentsSection)

### Key API Routes
| Route | Purpose |
|-------|---------|
| `/api/comprehensive-activity-data` | Fetch activity + photos + comments + streams |
| `/api/generate-pdf` | Render PDF from template |
| `/api/ai-generate` | Generate layout via Gemini |
| `/api/activities` | Paginated activity list |

## Environment Variables

Required in `web/.env.local`:
- `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET`
- `NEXTAUTH_SECRET` / `NEXTAUTH_URL`
- `NEXT_PUBLIC_MAPBOX_TOKEN`
- `GEMINI_API_KEY`
- `USE_REAL_AI=true` (toggle mock/real Gemini)

## PDF Generation Notes

- Uses @react-pdf/renderer for server-side PDF rendering
- Templates receive data via props, not direct API calls
- AI generates JSON design specs (parsed, not executed) for security
- Fonts are pre-downloaded in `web/public/fonts/` (41 fonts across 6 categories)
