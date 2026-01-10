# Strava Book - Current Plan

**Last updated:** 2025-01-10

---

## Project Status

| Component | Status |
|-----------|--------|
| Test infrastructure | ✅ Complete |
| Fixtures (16 activities + 4 years) | ✅ Complete |
| Book assembly & routing | ✅ Complete |
| AI Book Designer agents | ✅ Built & wired to UI |
| E2E tests | ✅ 28 tests passing |
| Templates | ⚡ Functional, need visual polish |

---

## Immediate Priority: Template Visual Polish

All templates exist and generate valid PDFs. They currently score 70-83 on visual judge but need polish to reach magazine quality.

### Self-Validating Loop

Each template can be improved iteratively:
1. Run `make test-template template=X fixture=Y`
2. Read visual judge feedback
3. Improve template based on suggestions
4. Repeat until score ≥ 80

### Templates to Polish

| Template | Fixture | Target |
|----------|---------|--------|
| Cover | race_marathon | Premium cover feel |
| YearStats | activeYear | Hero numbers, magazine style |
| YearCalendar | activeYear | Clean heatmap grid |
| Race_1p | race_marathon | High-impact race page |
| Race_2p | race_ultramarathon | Cohesive spread design |
| ActivityLog | activeYear | Scannable, good density |
| MonthlyDivider | activeYear | Bold, dynamic |
| BackCover | activeYear | Professional close |

---

## Secondary Priority: Graphics Generation

| Component | Status | Goal |
|-----------|--------|------|
| Splits chart | Needs improvement | Cleaner SVG, better scaling |
| Elevation profile | Needs improvement | Works at all sizes |
| Route maps | Needs improvement | High-quality static maps |
| Year heatmap | Needs improvement | GitHub contribution style |

---

## Overnight Agents

Run `./overnight-agents.sh` to launch 12 parallel agents:
- 8 template polish agents (Stream A)
- 4 graphics improvement agents (Stream B)

See `archive/` for historical planning docs.

---

## Reference Files

| File | Purpose |
|------|---------|
| SPEC.md | Technical specification |
| AGENT_INSTRUCTIONS.md | Agent workflow & test commands |
| CLAUDE.md | Project overview |
| overnight-agents.sh | Launch parallel agents |

---

## Verification Commands

```bash
# Test single template
make test-template template=Race_1p fixture=race_marathon

# List available templates and fixtures
make test-list

# Run integration tests (full book generation)
make test-integration-quick

# Check visual judge scores
# (Output in test-output/report.md after tests run)
```
