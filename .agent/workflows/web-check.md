---
description: Run web linting and build checks
---

# Web Check Workflow

This workflow runs ESLint and Next.js production build to verify code quality and ensure the application builds successfully.

## What it does:
- Runs `npm run lint` to check for code quality issues
- Runs `npm run build` to verify the production build works

## Usage:
You can reference this workflow by saying "run web-check" or "run the web-check workflow".

// turbo
1. Run `make web-check` from the project root

## Expected Output:
- ✓ Lint check passes with 0 errors and 0 warnings
- ✓ Build completes successfully
- ✓ All pages compile and generate correctly
