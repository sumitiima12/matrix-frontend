/**
 * test/loader.mjs — resolve extension-less relative imports for `node --test`.
 *
 * The app is built by Vite/esbuild, which happily resolve `import x from "../lib/series"` to
 * `series.js`. Raw Node ESM does not, so unit-testing modules that use that style would fail at
 * import time. This hook appends `.js` (or `/index.js`) to bare relative specifiers, matching the
 * bundler's behaviour — nothing more. It only touches ./ and ../ paths that lack an extension.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export async function resolve(specifier, context, next) {
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !/\.[a-zA-Z0-9]+$/.test(specifier)) {
    for (const suffix of [".js", ".mjs", "/index.js"]) {
      try {
        const url = new URL(specifier + suffix, context.parentURL);
        if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true };
      } catch { /* fall through to default resolution */ }
    }
  }
  return next(specifier, context);
}
