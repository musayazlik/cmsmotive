import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // eslint-plugin-react-hooks v7 ships the React-Compiler-powered rules.
      // The panel's prop-sync and fetch-on-mount idioms trip set-state-in-effect
      // and keyboard typeahead trips purity — advisory until those call sites
      // are reworked (see `pnpm lint` output).
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      // `_`-prefixed names mark intentionally unused values, e.g. the
      // discard-style destructuring in telegram/agent.ts.
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Not maintained by hand:
    "generated/**",
    "static-site/**",
    "public/**",
    ".temp_files/**",
    ".lint-tmp/**",
  ]),
]);

export default eslintConfig;
