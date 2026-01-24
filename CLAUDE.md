# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Strava Book is a web application that generates print-ready PDF "coffee table books" from Strava activity data. Users authenticate with Strava, curate activities, select templates, and generate publication-quality PDFs.

**Tech Stack:** Next.js 16 (React 19), TypeScript, Tailwind CSS 4, @react-pdf/renderer, NextAuth.js, Google Gemini AI, Mapbox

## Development Commands

All commands should use the Makefile. Never run Python scripts directly on the host.

```bash
make up            # Start Docker + web dev server (daily workflow)
make web-dev       # Start Next.js dev server (port 3000)
make web-check     # Run lint + build
make test          # Run pytest inside Docker container
make sync msg="..."  # Commit & push (always confirm message with user first)
```

## Mandatory Workflow

**These rules are non-negotiable:**

1. **Always use workspaces for code changes.** Before making ANY code changes:
   - Ask the user how they want to launch the workspace (see "Launching a Workspace" below)
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

### react-pdf Limitations

**NEVER use `objectFit` or `objectPosition`** - they don't work reliably in react-pdf. ESLint will flag any usage.

**NEVER use `transform: 'translateY(-50%)'`** for centering - transforms don't work reliably either.

To fill a container with an image, use simple absolute positioning:

```tsx
// Container clips overflow
<View style={{
  width: 300,
  height: 200,
  overflow: 'hidden',
  position: 'relative',
}}>
  {/* Image fills container - may stretch if aspect ratio differs */}
  <Image
    src={imageUrl}
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
    }}
  />
</View>
```

For true "cover" behavior (fill container, maintain aspect ratio, clip excess), you must know image dimensions ahead of time. Most activity photos are landscape, so filling width/height works well.

### Style Guide (IMPORTANT)

**Always read `docs/StyleGuide.md` before modifying any PDF template.** The style guide defines:

- **Typography system**: Use `resolveTypography(role, theme, format)` - never hardcode font sizes
- **Color system**: Use `theme.primaryColor`, `theme.accentColor`, `theme.backgroundColor` - never hardcode colors
- **Spacing system**: Use `resolveSpacing(theme, format)` - never hardcode margins/padding
- **Effects system**: Use `resolveEffects(theme)` for opacity values
- **Primitives**: Use `FullBleedBackground`, `AutoResizingPdfText`, `PageHeader` components

When modifying templates:
1. Import utilities from `@/lib/typography`
2. Resolve all values from theme, not hardcoded
3. Use primitive components for backgrounds and text
4. Apply text background opacity only when there's an image behind

**If you add new design tokens or patterns, update the StyleGuide.md.**

## Multi-Agent Parallel Development

When running multiple Claude Code sessions in parallel, use isolated workspaces to avoid conflicts.

### Launching a Workspace

**Always ask the user** before creating a workspace. Use the AskUserQuestion tool with these options:

1. **Background process** - Claude runs `make workspace-claude` in the background. Good for straightforward fixes where the user wants to monitor progress but not interact directly.

2. **New terminal (interactive)** - User runs the command themselves in a new terminal window. Good for complex tasks where the user wants to interact with the new Claude session directly.

Example question to ask:
> "I need to create a workspace for this fix. How would you like to launch it?"
> - Background (I'll monitor and report back)
> - New terminal (you'll interact with the new session)

**If background:** Run `make workspace-claude name=X prompt="Y"` with `run_in_background: true`, then periodically check on progress.

**If new terminal:** Provide the command for the user to copy:
```bash
cd ~/bin/strava-book
make workspace-claude name=feature-name prompt="Task description here"
```

### Handoff Context

Whether background or interactive, provide a clear task description. Include:
- What needs to be fixed/implemented
- Key files involved
- Any important context from the conversation

### Workspace Commands
```bash
make workspace-claude name=X prompt="Y"  # Create workspace + launch Claude (preferred)
make workspace-new name=X                # Create workspace only
make workspace-list                      # Show all workspaces with status
make workspace-start id=X                # Start a stopped workspace
make workspace-stop id=X                 # Stop a workspace container
make workspace-destroy id=X              # Remove workspace completely
make workspace-cleanup                   # Remove stale workspaces (inactive >24h)
make workspace-info                      # Show current workspace context
make workspace-merge pr=N                # Merge PR and sync main worktree (ALWAYS USE THIS)
make sync-main                           # Sync main worktree with origin/main
```

### How It Works
- Each workspace is a git worktree with its own branch
- Each workspace runs in a dedicated Docker container on a unique port (3001-3020)
- The `.env.local` is copied from the main repo (shared secrets)
- Workspaces are tracked in `~/bin/strava-workspaces/registry.json`
- Workspaces inactive for >24h are marked "stale" and can be cleaned up
- **Makefile is workspace-aware**: All `make` commands automatically detect workspace context
  - `make web-dev` uses the correct port based on `.workspace.json`
  - `make web-restart` stops/starts the correct container
  - `make test-e2e-ci` runs tests against the workspace port

### Workspace-Aware Commands
The Makefile automatically detects if you're in a workspace and adjusts behavior:

| Context | Port | Docker Compose File | Container Filter |
|---------|------|---------------------|------------------|
| Main repo | 3000 | docker-compose.yml | strava-book |
| Workspace | Assigned (3001-3020) | docker-compose.workspace.yml | strava-ws-{id} |

Run `make workspace-info` to see the current context.

### Workflow for Parallel Development

**One workspace = one PR.** Never reuse a workspace for multiple PRs.

1. Main repo (`~/bin/strava-book`) stays clean - never edit directly
2. Create workspace for the task: `make workspace-claude name=<feature> prompt="task description"`
3. Work in the workspace, create PR when done
4. Wait for user to approve, then merge using: `make workspace-merge pr=<PR_NUMBER>`
5. **Immediately destroy the workspace:** `make workspace-destroy id=<workspace-id>`
6. If more work is needed, create a fresh workspace (do not reuse the old one)

### Avoiding Merge Conflicts

GitHub squash-merges create new commits that don't share history with workspace branches. This causes git to see branches as "diverged" even when the code is already on main. To avoid conflicts:

1. **Never reuse workspaces** - After a PR is merged, destroy the workspace. If you need to do follow-up work, create a new workspace. Reusing a workspace after its PR was squash-merged will cause conflicts.

2. **Always use `make workspace-merge`** - This syncs the main worktree after merging, preventing staleness.

3. **Clean up promptly** - Run `make workspace-cleanup` periodically to remove stale workspaces and their branches.

### Merging PRs (IMPORTANT)

**Always use `make workspace-merge pr=<N>` instead of `gh pr merge` directly.** This command:
1. Merges the PR on GitHub (squash merge)
2. Automatically syncs the main worktree with origin/main

This prevents the main worktree from becoming stale, which would cause merge conflicts in future PRs.

If someone merges a PR via GitHub UI (not using `make workspace-merge`), run:
```bash
make sync-main
```

### Why Git Worktrees (Not Clones)
The workspace system uses git worktrees rather than full clones. This is intentional:

**Advantages of worktrees:**
- Lightweight: Shares git objects, ~10x faster to create than clone
- Branch coordination: All worktrees see each other's branches
- Single remote: Push/pull affects all workspaces consistently
- Easy cleanup: `git worktree remove` is cleaner than deleting clones

**When clones would be better:**
- Working on completely unrelated histories
- Need to test against different remote branches simultaneously
- Want complete isolation (worktrees share reflog, stash, etc.)

For this use case (parallel agent development on features that merge to main), worktrees provide the right balance of isolation and coordination.
