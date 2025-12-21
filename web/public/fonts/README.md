# Font Collection for Strava Book Templates

This directory contains **41 fonts** across 6 categories, providing a comprehensive range of typography options for customizing the `race_1p` template and other PDF templates.

## 📦 Installation

To download all fonts, run:
```bash
./scripts/download-fonts.sh
```

## 🎨 Font Categories

### 📖 Serif Fonts (Professional, Traditional, Elegant)
Perfect for formal race reports, marathon recaps, or professional presentations.

- **Merriweather** (Regular, Bold) - Highly readable, great for body text
- **Playfair Display** (Regular, Bold) - Elegant, excellent for titles
- **Lora** (Regular, Bold) - Classic, readable serif
- **Crimson Text** (Regular, Bold) - Traditional book-style font

**Use cases:** Marathon reports, formal race recaps, professional presentations

---

### 🏃 Sans-Serif Fonts (Modern, Clean, Sporty)
Modern and athletic feel, perfect for most running activities.

- **Roboto** (Light, Regular, Bold) - Modern, versatile, multiple weights
- **Open Sans** (Regular, Bold) - Clean, highly readable
- **Montserrat** (Regular, Bold) - Geometric, great for headers
- **Inter** (Regular, Bold) - Modern, optimized for screens
- **Oswald** (Regular, Bold) - Condensed, athletic feel

**Use cases:** Training runs, workout summaries, modern race pages

---

### 💪 Display/Decorative Fonts (Bold Statements, Titles)
Eye-catching fonts for titles and headers that demand attention.

- **Bebas Neue** - Bold, condensed, sporty
- **Anton** - Heavy, impactful
- **Righteous** - Bold, slightly rounded
- **Archivo Black** - Strong, commanding
- **Bangers** - Comic-style, energetic

**Use cases:** Race titles, achievement highlights, motivational headers

---

### ✍️ Handwritten/Script Fonts (Personal, Casual, Scrapbook-style)
Personal touch for casual runs, training logs, or scrapbook-style pages.

- **Indie Flower** - Casual, friendly handwriting
- **Patrick Hand** - Natural handwriting style
- **Caveat** (Regular, Bold) - Natural, flowing handwriting
- **Permanent Marker** - Bold marker style
- **Shadows Into Light** - Friendly handwriting
- **Dancing Script** (Regular, Bold) - Elegant script

**Use cases:** Personal training logs, casual runs, scrapbook templates

---

### 🔢 Monospace Fonts (Data, Technical, Stats)
Fixed-width fonts ideal for displaying technical data and statistics.

- **Roboto Mono** (Regular, Bold) - Clean monospace
- **Source Code Pro** (Regular, Bold) - Readable code font

**Use cases:** Pace tables, split times, technical data displays

---

### 📊 Condensed Fonts (Space-efficient for data)
Narrow fonts that fit more information in tight spaces.

- **Roboto Condensed** (Regular, Bold) - Compact but readable
- **Barlow Condensed** (Regular, Bold) - Modern condensed

**Use cases:** Data-heavy pages, tables, compact layouts

---

## 💻 Usage in React-PDF

To use these fonts in your templates, register them first:

```typescript
import { Font } from '@react-pdf/renderer'

// Register a font
Font.register({
  family: 'Roboto',
  src: '/fonts/Roboto-Regular.ttf',
})

Font.register({
  family: 'Roboto',
  src: '/fonts/Roboto-Bold.ttf',
  fontWeight: 'bold',
})

// Use in styles
const styles = StyleSheet.create({
  title: {
    fontFamily: 'Roboto',
    fontWeight: 'bold',
    fontSize: 24,
  },
})
```

## 🎯 Recommended Combinations

### Classic & Professional
- **Title:** Playfair Display Bold
- **Body:** Merriweather Regular
- **Stats:** Roboto Mono

### Modern & Athletic
- **Title:** Bebas Neue
- **Body:** Roboto Regular
- **Stats:** Roboto Condensed Bold

### Personal & Casual
- **Title:** Indie Flower
- **Body:** Patrick Hand
- **Stats:** Roboto Regular

### Bold & Impactful
- **Title:** Anton
- **Subtitle:** Oswald Bold
- **Body:** Open Sans Regular

## 📝 Font Pairing Tips

1. **Contrast is key:** Pair a decorative title font with a simple body font
2. **Limit to 2-3 fonts:** Too many fonts create visual chaos
3. **Match the mood:** Handwritten for casual, serif for formal, sans-serif for sporty
4. **Hierarchy matters:** Use font weight and size to create clear visual hierarchy

## 📄 License

All fonts are from Google Fonts and are licensed under the SIL Open Font License (OFL) or Apache License 2.0, making them free for personal and commercial use.

## 🔄 Updating Fonts

To re-download or update fonts, simply run the script again:
```bash
./scripts/download-fonts.sh
```

The script will skip fonts that already exist and only download new ones.
