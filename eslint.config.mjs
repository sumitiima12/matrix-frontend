/**
 * Minimal lint gate focused on the ONE rule that has actually bitten us: Rules of Hooks.
 * A hook called conditionally or inside a callback (the Portfolio #300 crash, the Screener
 * misnamed helper) passes the build and the render-smoke test but blows up at runtime on a
 * mode switch. This catches it statically. `exhaustive-deps` is intentionally OFF — the
 * codebase deliberately narrows effect deps in many places and we don't want the noise.
 *
 * Run: npm run lint   (fails only on errors, e.g. a real rules-of-hooks violation)
 */
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist/**", "node_modules/**", "scripts/**"] },
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: { ecmaVersion: 2023, sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
    linterOptions: { reportUnusedDisableDirectives: "off" },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off",
    },
  },
];
