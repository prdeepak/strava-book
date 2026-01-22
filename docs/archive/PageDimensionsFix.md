# Fix PDF Page Dimension Issues

## Problem

Some PDF pages render at incorrect sizes because:
1. Hardcoded `size="LETTER"` in placeholder pages and scrapbook template
2. No enforcement mechanism to clip overflowing content
3. Potential overflow issues in templates with variable content

## Tasks

### 1. Fix Hardcoded LETTER Sizes

**BookDocument.tsx** (lines ~631, 641, 651):
- BEST_EFFORTS placeholder page uses `size="LETTER"`
- ROUTE_HEATMAP placeholder page uses `size="LETTER"`
- STATS_SUMMARY placeholder page uses `size="LETTER"`

Change all to:
```tsx
<Page size={[format.dimensions.width, format.dimensions.height]} style={styles.placeholderPage}>
```

**race_1p_scrapbook.tsx** (lines ~329, 657):
- Both `<Page>` elements use `size="LETTER"`

Change to use format dimensions (may need to add format prop if missing).

### 2. Create PageWrapper Component

Create `web/components/pdf/PageWrapper.tsx`:

```tsx
import { Page, View, StyleSheet } from '@react-pdf/renderer';
import { BookFormat, BookTheme, FORMATS, DEFAULT_THEME } from '@/lib/book-types';
import { ReactNode } from 'react';

interface PageWrapperProps {
  format?: BookFormat;
  theme?: BookTheme;
  children: ReactNode;
  style?: object;
}

export const PageWrapper = ({
  format = FORMATS['10x10'],
  theme = DEFAULT_THEME,
  children,
  style = {},
}: PageWrapperProps) => {
  const { width, height } = format.dimensions;

  const styles = StyleSheet.create({
    page: {
      width,
      height,
      backgroundColor: theme.backgroundColor,
      ...style,
    },
    container: {
      width,
      height,
      overflow: 'hidden',
    },
  });

  return (
    <Page size={[width, height]} style={styles.page}>
      <View style={styles.container}>
        {children}
      </View>
    </Page>
  );
};
```

This component:
- Enforces exact page dimensions via Page size prop
- Clips any overflowing content with `overflow: hidden`
- Accepts format and theme for consistency
- Can be used as drop-in replacement for raw `<Page>` elements

### 3. Audit All Templates

Check each file in `web/components/templates/` for:

| Check | What to Look For |
|-------|------------------|
| Format prop | Does component accept and use `format` prop? |
| Page size | Does `<Page>` use `format.dimensions.width/height`? |
| Overflow risk | Are there containers without height constraints? |
| Flex layout | Does content use `flex: 1` to fill available space? |
| ScaleFactor | Are font sizes and spacing using `format.scaleFactor`? |

**Templates to audit:**
- [ ] Cover.tsx
- [ ] BackCover.tsx
- [ ] Foreword.tsx
- [ ] TableOfContents.tsx
- [ ] YearStats.tsx
- [ ] YearCalendar.tsx
- [ ] MonthlyDividerSpread.tsx
- [ ] ActivityLog.tsx
- [ ] Race_1p.tsx
- [ ] Race_2p.tsx
- [ ] RaceSection.tsx (and sub-components)
- [ ] BlankPage.tsx
- [ ] BookDocument.tsx

Document any issues found and fix them.

## Validation

Before creating PR:

```bash
make test-e2e-ci
```

All tests must pass, especially template dimension tests which verify 720x720 output.

## Reference

Format definitions in `web/lib/book-types.ts`:
```typescript
export const FORMATS = {
  '8x8':   { dimensions: { width: 576, height: 576 }, scaleFactor: 0.8 },
  '10x10': { dimensions: { width: 720, height: 720 }, scaleFactor: 1.0 },  // default
  '12x12': { dimensions: { width: 864, height: 864 }, scaleFactor: 1.2 },
}
```
