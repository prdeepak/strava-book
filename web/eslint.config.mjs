import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

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
  // Custom rules for react-pdf compatibility
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
        // Ban hardcoded hex colors - use theme colors instead
        // Exceptions: medal colors (gold #FFD700, silver #C0C0C0, bronze #CD7F32)
        {
          selector: "Literal[value=/^#(?![Ff][Ff][Dd]700$|[Cc]0[Cc]0[Cc]0$|[Cc][Dd]7[Ff]32$)[0-9A-Fa-f]{3,8}$/]",
          message: "Avoid hardcoded hex colors. Use theme.primaryColor, theme.accentColor, or theme.backgroundColor instead. Medal colors (gold/silver/bronze) are exempt.",
        },
        // Ban hardcoded font families - use theme.fontPairing instead
        {
          selector: "Literal[value=/^(Helvetica|Helvetica-Bold|Helvetica-Oblique|Arial|Times|Times-Roman|Courier|Georgia|Verdana)$/]",
          message: "Avoid hardcoded font names. Use theme.fontPairing.heading or theme.fontPairing.body instead.",
        },
      ],
    },
  },
]);

export default eslintConfig;
