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
    "next-env.d.ts",
    // The API bundle (npm run build:server) and the shared rate-limit engine, vendored byte for byte.
    "server/dist/**",
    "server/rateLimitEngine.js",
  ]),
]);

export default eslintConfig;
