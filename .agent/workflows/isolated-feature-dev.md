---
description: How to safely develop new features using isolated workspaces
---
# Isolated Feature Development Workflow

This workflow ensures that all development happens in isolated workspaces, preserving the stability of the main branch.

## 1. Create Workspace
Start by creating a new isolated workspace for your feature.
```bash
make workspace-new name=<feature_name>
```
*Note the Workspace ID output by this command (e.g., ws-123456).*

## 2. Switch Context
Switch your context to work exclusively within the new workspace directory.
```bash
# The workspace manager will output the path:
cd /Users/deepak/bin/strava-workspaces/<workspace_id>
```

## 3. Develop & Verify
Perform all research, coding, and testing within this isolated environment.
- **Plan**: Create implementation plans, research files, etc.
- **Code**: Modify files within this workspace only.
- **Test**: Run local tests and e2e tests.
```bash
make test-e2e-ci
```

## 4. Create Pull Request
When ready for human review, create a PR from your workspace branch.
*Note: Do not merge to main yourself.*

```bash
# Push the branch (already set up by workspace-new)
git push origin <branch_name>

# Create PR (using GitHub CLI if available, or manual)
gh pr create --title "Feature: <feature_name>" --body "Description of changes..."
```
