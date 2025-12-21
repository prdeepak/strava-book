# Project Rules for Strava Book

## Code Quality Standards

### Before Responding
- **Always run `make web-check`** before completing any task that modifies code
- This ensures all changes pass linting and build successfully
- Only respond to the user after verification passes

### Development Workflow
1. Make code changes
2. Run `make web-check` to verify
3. If checks pass, respond to user
4. If checks fail, fix issues and re-run

### Exception
- Skip `make web-check` for non-code tasks (documentation, questions, etc.)
- Skip if the user explicitly says "skip checks" or similar

## Code Style
- Use TypeScript strict mode
- Follow ESLint rules (no warnings allowed)
- Ensure production builds succeed before completion
