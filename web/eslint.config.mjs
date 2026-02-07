import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Shared rule: ban hardcoded hex colors in react-pdf files — use theme colors instead
// Exceptions: medal colors (gold #FFD700, silver #C0C0C0, bronze #CD7F32)
const hexColorRule = {
  selector: "Literal[value=/^#(?![Ff][Ff][Dd]700$|[Cc]0[Cc]0[Cc]0$|[Cc][Dd]7[Ff]32$)[0-9A-Fa-f]{3,8}$/]",
  message: "Avoid hardcoded hex colors in PDF files. Use theme colors (primaryColor, accentColor, backgroundColor, surfaceColor, borderColor, textOverAccent) or eslint-disable with a reason. See docs/StyleGuide.md.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Rules for react-pdf template and primitive files
  // These files render to print PDFs and must use the theme color system
  {
    files: ["components/templates/**/*.tsx", "components/pdf/**/*.tsx"],
    rules: {
      // Ban objectFit/objectPosition - they don't work in react-pdf
      "no-restricted-syntax": [
        "error",
        {
          selector: "Property[key.name='objectFit']",
          message: "objectFit doesn't work in react-pdf. Use absolute positioning with width/height: '100%' instead. See CLAUDE.md for the correct pattern.",
        },
        {
          selector: "Property[key.name='objectPosition']",
          message: "objectPosition doesn't work in react-pdf. Use absolute positioning instead. See CLAUDE.md for the correct pattern.",
        },
        hexColorRule,
        // Ban hardcoded font families - use theme.fontPairing instead
        {
          selector: "Literal[value=/^(Helvetica|Helvetica-Bold|Helvetica-Oblique|Arial|Times|Times-Roman|Courier|Georgia|Verdana)$/]",
          message: "Avoid hardcoded font names. Use theme.fontPairing.heading or theme.fontPairing.body instead.",
        },
        // Ban inline distance conversions - use formatDistance/formatDistanceValue from activity-utils
        {
          selector: "BinaryExpression[operator='/'] > MemberExpression[property.name='distance']",
          message: "Don't divide distance inline. Use formatDistance() or formatDistanceValue() from @/lib/activity-utils.",
        },
        // Ban .toFixed() on distance-like divisions (/ 1000 or / 1609)
        {
          selector: "CallExpression[callee.property.name='toFixed'][callee.object.type='BinaryExpression'][callee.object.operator='/']",
          message: "Don't format numbers inline with .toFixed(). Use shared formatters from @/lib/activity-utils.",
        },
      ],
      // Ban local shadow formatters that duplicate shared utilities
      "no-shadow": ["warn", {
        allow: ["styles"],
      }],
    },
  },
  // Hex color ban for PDF-adjacent lib files that generate SVG/charts for print
  {
    files: [
      "lib/generateElevationProfile.tsx",
      "lib/heatmap-utils.ts",
      "lib/calendar-views.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        hexColorRule,
      ],
    },
  },
]);

export default eslintConfig;
