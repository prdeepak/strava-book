# Strava Book Style Guide

This document defines the design system for PDF book templates. All templates must use these systems for consistency and maintainability.

## Design System Architecture

```
BookTheme (book-types.ts)
├── colors: primaryColor, accentColor, backgroundColor
├── typography: displayLarge, heading, body, caption, stat
├── spacing: xs, sm, md, lg, xl
└── effects: backgroundImageOpacity, textOverlayOpacity

    ↓ resolved by

Typography Utilities (typography.ts)
├── resolveTypography(role, theme, format) → fontSize, minFontSize, fontFamily
├── resolveSpacing(theme, format) → scaled spacing values
└── resolveEffects(theme) → effect values

    ↓ used by

Primitives (components/pdf/)
├── FullBleedBackground - hero/background images with cropping
├── AutoResizingPdfText - text with auto-sizing and background opacity
└── PageHeader - standardized section headers

    ↓ composed into

Templates (components/templates/)
├── Cover.tsx, BackCover.tsx
├── YearStats.tsx, YearCalendar.tsx
└── RaceSection.tsx, MonthlyDivider.tsx, etc.
```

## Typography System

### Typography Roles

Define text styles semantically, not by size:

| Role | Purpose | Base Size (10x10) | Scaling |
|------|---------|-------------------|---------|
| `displayLarge` | Cover titles, hero text | 72pt | display |
| `displaySmall` | Section headers | 48pt | display |
| `heading` | Page titles | 24pt | heading |
| `subheading` | Secondary titles | 18pt | heading |
| `body` | Paragraphs, descriptions | 14pt | body |
| `caption` | Photo labels, fine print | 10pt | body |
| `stat` | Big numbers on stats pages | 32pt | display |

### Scaling Behaviors

- **display**: Scales linearly with page size (maintains visual proportion)
- **heading**: Scales moderately (85% fixed + 15% scaled)
- **body**: Scales minimally (95% fixed + 5% scaled) for readability

### Usage

```tsx
import { resolveTypography } from '@/lib/typography'

const displayLarge = resolveTypography('displayLarge', theme, format)
// Returns: { fontSize: 72, minFontSize: 48, fontFamily: 'Helvetica-Bold', letterSpacing: 2 }
```

With AutoResizingPdfText:
```tsx
<AutoResizingPdfText
  text={title}
  width={contentWidth}
  height={titleHeight}
  font={displayLarge.fontFamily}
  min_fontsize={displayLarge.minFontSize}
  max_fontsize={displayLarge.fontSize}
  // ...
/>
```

## Color System

### Theme Colors

| Color | Purpose | Default |
|-------|---------|---------|
| `primaryColor` | Dark brand color, text backgrounds | `#1a1a1a` |
| `accentColor` | Highlights, titles, decorative elements | `#ff6b35` |
| `backgroundColor` | Page background, light text on dark | `#ffffff` |
| `accentForWhiteBg` | Accessible accent on white (optional) | - |
| `accentBackground` | Background for accent-colored text | - |

### Color Usage Patterns

**Text on hero images:**
- Title: `theme.accentColor`
- Body text: `theme.backgroundColor` (inverted for contrast)
- Text background: `theme.primaryColor` with opacity

**Text on solid backgrounds:**
- Use `theme.primaryColor` for text
- No text background needed

### Never Hardcode Colors

```tsx
// BAD
textColor="#ffffff"
backgroundColor="black"

// GOOD
textColor={theme.backgroundColor}
backgroundColor={theme.primaryColor}
```

## Spacing System

### Spacing Scale

| Token | Base Value | Purpose |
|-------|------------|---------|
| `xs` | 8pt | Tight spacing, icon gaps |
| `sm` | 16pt | Default element spacing |
| `md` | 24pt | Section spacing |
| `lg` | 48pt | Major section breaks |
| `xl` | 72pt | Page-level spacing |

### Usage

```tsx
import { resolveSpacing } from '@/lib/typography'

const spacing = resolveSpacing(theme, format)
// Returns scaled values: { xs: 8, sm: 16, md: 24, lg: 48, xl: 72 } for 10x10
// For 8x8: { xs: 6, sm: 13, md: 19, lg: 38, xl: 58 }

// Use in styles:
marginBottom: spacing.sm,
padding: spacing.md,
```

## Effects System

### Effect Values

| Effect | Purpose | Default |
|--------|---------|---------|
| `backgroundImageOpacity` | Faded background images | 0.5 |
| `textOverlayOpacity` | Dark scrim behind text on images | 0.3 |

### Conditional Application

Text backgrounds are only needed when there's an image behind:

```tsx
const effects = resolveEffects(theme)
const hasImageBackground = !!bgImage
const textBgOpacity = hasImageBackground ? effects.textOverlayOpacity : 0

<AutoResizingPdfText
  backgroundColor={theme.primaryColor}
  backgroundOpacity={textBgOpacity}  // 0.3 if image, 0 if solid color
/>
```

## Primitive Components

### FullBleedBackground

Full-page background with image cropping and overlay support.

```tsx
import { FullBleedBackground } from '@/components/pdf/FullBleedBackground'

<FullBleedBackground
  image={photoUrl}              // Optional - falls back to solid color
  fallbackColor={theme.primaryColor}
  role="hero"                   // 'hero' (full opacity) or 'background' (faded + overlay)
  width={format.dimensions.width}
  height={format.dimensions.height}
/>
```

**Photo Roles:**
- `hero`: Full opacity, no overlay. The photo IS the content.
- `background`: Reduced opacity + dark overlay for text readability.

### AutoResizingPdfText

Text that auto-sizes to fit container with optional background.

```tsx
import { AutoResizingPdfText } from '@/components/pdf/AutoResizingPdfText'

<AutoResizingPdfText
  text="Title Text"
  width={300}
  height={80}
  font={typography.fontFamily}
  min_fontsize={typography.minFontSize}
  max_fontsize={typography.fontSize}
  h_align="center"
  v_align="middle"
  textColor={theme.accentColor}
  backgroundColor={theme.primaryColor}
  backgroundOpacity={0.3}       // Only when over images
  resize_to_text={true}         // Background hugs text vs fills container
/>
```

### PageHeader

Standardized section headers with size variants.

```tsx
import { PageHeader } from '@/components/pdf/PageHeader'

<PageHeader
  title="2024"
  subtitle="Year in Review"
  size="hero"                   // 'medium' | 'large' | 'hero'
  alignment="center"
  theme={theme}
  format={format}
/>
```

## Template Checklist

When creating or modifying a template:

1. **Import typography utilities:**
   ```tsx
   import { resolveTypography, resolveSpacing, resolveEffects } from '@/lib/typography'
   ```

2. **Resolve all values from theme:**
   ```tsx
   const displayLarge = resolveTypography('displayLarge', theme, format)
   const spacing = resolveSpacing(theme, format)
   const effects = resolveEffects(theme)
   ```

3. **Use primitives for backgrounds and text:**
   - `FullBleedBackground` for full-page images
   - `AutoResizingPdfText` for dynamic text sizing
   - `PageHeader` for section headers

4. **Never hardcode:**
   - Colors (use `theme.*`)
   - Font sizes (use `resolveTypography`)
   - Spacing (use `resolveSpacing`)
   - Opacity values (use `resolveEffects`)

5. **Conditional text backgrounds:**
   ```tsx
   const textBgOpacity = hasImageBackground ? effects.textOverlayOpacity : 0
   ```

## Format Support

The system supports multiple book formats:

| Format | Dimensions | Scale Factor |
|--------|------------|--------------|
| 8x8 | 576 × 576pt | 0.8 |
| 10x10 | 720 × 720pt | 1.0 (reference) |
| 12x12 | 864 × 864pt | 1.2 |

Future non-square formats (8x10, 10x8) will work automatically - the typography system derives scale factors from dimensions.

## Files Reference

- **Type definitions:** `web/lib/book-types.ts`
- **Typography utilities:** `web/lib/typography.ts`
- **Primitives:** `web/components/pdf/`
- **Templates:** `web/components/templates/`
- **Default theme:** `DEFAULT_THEME` in `book-types.ts`
