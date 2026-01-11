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

## Mandatory Workflow

**These rules are non-negotiable:**

1. **Always use workspaces for code changes.** Before making ANY code changes:
   - Run `make workspace-new name=<feature>`
   - Immediately `cd` into the workspace directory shown in the output
   - All subsequent work happens in that workspace
   - Never edit code directly in the main repo (`~/bin/strava-book`)

2. **Always create PRs for approval.** Never push directly to main - branch protection will reject it. Always:
   - Create a feature branch
   - Push to origin
   - Create a PR with `gh pr create`
   - Wait for user approval before merging

3. **Never merge PRs without explicit approval.** The `gh pr merge` command is denied by permission settings. Always wait for the user to approve and merge.

4. **Run e2e tests before marking code ready.** Before telling the user that code is ready for review or creating a PR, run `make test-e2e-ci` and ensure all tests pass.

## Temporary Files

Always create temporary files inside the current workspace directory (e.g., `./tmp/` or `./.scratch/`), never in `/tmp` or other system directories. This ensures:
- Cleanup when workspace is destroyed
- Isolation between parallel workspaces

## Command Usage

**Use allowed commands individually.** Avoid chaining commands (e.g., `cd && ls && grep`) when the individual commands are already permitted. Chained commands may trigger permission prompts even when their components wouldn't.

Prefer:
```bash
# Separate calls - each uses allowed command
ls /path/to/dir
grep "pattern" file.txt
```

Avoid:
```bash
# Chained - may trigger permission prompt
cd /path && ls && grep "pattern" file.txt
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
3. User selects activities → Curates book contents
4. User generates book → POST to `/api/generate-book-pdf`
5. Backend renders React-PDF component → returns binary PDF

### Key Directories
```
web/
├── app/                    # Next.js routes
│   ├── builder/           # Main app page (activity curation)
│   ├── preview/           # Template preview routes
│   └── api/               # Backend endpoints
├── components/
│   ├── BuilderClient.tsx  # Main UI (activity list, filtering)
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
- **Templates**: Pure data rendering, PDF-specific (Race_1p, Race_2p, BookDocument)
- **PDF Components**: Reusable React-PDF views (Header, StatsGrid, CommentsSection)

### Key API Routes
| Route | Purpose |
|-------|---------|
| `/api/comprehensive-activity-data` | Fetch activity + photos + comments + streams |
| `/api/generate-book-pdf` | Render full book PDF from curated activities |
| `/api/ai-book-designer` | AI-powered book design via Gemini |
| `/api/activities` | Paginated activity list |

## Environment Variables

Required in `web/.env.local`:
- `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET`
- `NEXTAUTH_SECRET` / `NEXTAUTH_URL`
- `NEXT_PUBLIC_MAPBOX_TOKEN`
- `GEMINI_API_KEY`

## PDF Generation Notes

- Uses @react-pdf/renderer for server-side PDF rendering
- Templates receive data via props, not direct API calls
- Fonts are pre-downloaded in `web/public/fonts/` (41 fonts across 6 categories)

## Multi-Agent Parallel Development

When running multiple Claude Code sessions in parallel, use isolated workspaces to avoid conflicts.

### Quick Start
```bash
# Create a new isolated workspace
make workspace-new name=feature-name

# Output shows workspace path and port, e.g.:
#   Directory: ~/bin/strava-workspaces/ws-abc123
#   Dev server: http://localhost:3001

# IMPORTANT: Immediately cd into the workspace before any code changes
cd ~/bin/strava-workspaces/ws-abc123
```

### Workspace Commands
```bash
make workspace-new name=X   # Create isolated workspace (auto-starts container)
make workspace-list         # Show all workspaces with status
make workspace-start id=X   # Start a stopped workspace
make workspace-stop id=X    # Stop a workspace container
make workspace-destroy id=X # Remove workspace completely
make workspace-cleanup      # Remove stale workspaces (inactive >24h)
```

### How It Works
- Each workspace is a git worktree with its own branch
- Each workspace runs in a dedicated Docker container on a unique port (3001-3020)
- The `.env.local` is symlinked from the main repo (shared secrets)
- Workspaces are tracked in `~/bin/strava-workspaces/registry.json`
- Workspaces inactive for >24h are marked "stale" and can be cleaned up

### Workflow for Parallel Development
1. Main repo (`~/bin/strava-book`) stays clean - never edit directly
2. Create workspaces for each task: `make workspace-new name=<feature>`
3. Each Claude Code session works in its own workspace
4. When done, create PR from workspace branch to main
5. Wait for user to approve and merge the PR
6. Cleanup workspace after merge: `make workspace-destroy id=<workspace-id>`
