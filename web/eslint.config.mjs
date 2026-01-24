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
      ],
    },
  },
]);

export default eslintConfig;
