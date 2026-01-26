# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Project Overview

Strava Book generates print-ready PDF "coffee table books" from Strava activity data. Users authenticate with Strava, curate activities, select templates, and generate publication-quality PDFs.

**Tech Stack:** Next.js 16 (React 19), TypeScript, Tailwind CSS 4, @react-pdf/renderer, NextAuth.js, Google Gemini AI, Mapbox

## Commands

```bash
make up              # Start Docker + dev server (daily workflow)
make web-check       # Lint + build
make test-e2e-ci     # Run e2e tests (required before PRs)
```

## Mandatory Rules

1. **Always use workspaces for code changes.** Never edit code in `~/bin/strava-book/main`. Each workspace runs in its own devcontainer for isolation.

2. **Always create PRs.** Branch protection prevents direct pushes to main.

3. **Never merge without approval.** Wait for the user to approve and merge.

4. **Run e2e tests before PRs.** Run `make test-e2e-ci` and ensure all tests pass.

5. **One workspace = one PR.** After merge, destroy the workspace immediately. Create a fresh workspace for follow-up work.

## Workspace Workflow

Development happens in isolated workspaces, each running in its own devcontainer.

### Directory Structure

```
~/bin/strava-book/
├── main/           # Read-only main branch (for oversight, creating worktrees)
└── workspaces/     # Development workspaces (devcontainer per workspace)
```

### Creating a Workspace

```bash
# From ~/bin/strava-book/main
make workspace-claude name=X prompt="Y"  # Create workspace + launch Claude
make workspace-list                      # Show all workspaces
```

### Working in a Workspace

Each workspace should be opened in VS Code/Cursor and reopened in its devcontainer:
1. Open the workspace folder (e.g., `~/bin/strava-book/workspaces/ws-abc123`)
2. VS Code will detect `.devcontainer/` and offer to reopen in container
3. Accept to get the isolated development environment

### After PR is Merged

```bash
make workspace-merge pr=N    # Merge PR (always use this, not gh pr merge)
make workspace-destroy id=X  # Remove workspace after merge
```

**Never reuse a workspace after its PR is merged** - GitHub squash-merges create new commits that diverge from workspace branches.

## Architecture

### Data Flow
1. `/` → Strava OAuth via NextAuth
2. `/builder` → Fetches activities, displays in BuilderClient
3. User curates activities → generates book → POST to `/api/generate-book-pdf`
4. Backend renders React-PDF → returns binary PDF

### Key Directories
```
web/
├── app/                    # Next.js routes (builder/, preview/, api/)
├── components/
│   ├── BuilderClient.tsx   # Main UI
│   ├── templates/          # PDF page templates
│   └── pdf/                # Reusable PDF primitives
└── lib/
    ├── strava.ts           # Strava API client
    └── typography.ts       # PDF design system utilities
```

### Key API Routes
| Route | Purpose |
|-------|---------|
| `/api/comprehensive-activity-data` | Fetch activity + photos + comments + streams |
| `/api/generate-book-pdf` | Render full book PDF |
| `/api/ai-book-designer` | AI-powered book design via Gemini |

## PDF Development

**Read `docs/StyleGuide.md` before modifying any PDF template.** It defines:
- Typography, color, spacing, and effects systems
- Primitive components (`FullBleedBackground`, `PdfImage`, `AutoResizingPdfText`, `PageHeader`)
- Page layout patterns and react-pdf limitations

## Environment Variables

Required in `web/.env.local`:
- `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET`
- `NEXTAUTH_SECRET` / `NEXTAUTH_URL`
- `NEXT_PUBLIC_MAPBOX_TOKEN`
- `GEMINI_API_KEY`
