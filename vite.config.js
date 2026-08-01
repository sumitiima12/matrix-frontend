import { defineConfig } from "vite";

/**
 * Vite build config — bundle-size hygiene (ENG-3).
 *
 * The app already route-splits its heavy pages via React.lazy (StockDetail, Portfolio, Automation,
 * Screener, …). The remaining large item in the MAIN chunk is the charting stack (recharts + d3),
 * which is imported eagerly by the shell. Splitting those — and React itself — into their own vendor
 * chunks shrinks the initial app chunk and, because their content-hash only changes when the library
 * changes (not on every app edit), lets the browser keep them cached across deploys.
 *
 * Chunking ONLY — no plugin/transform change — so it cannot alter app behaviour, only how the output
 * is partitioned. Validate locally with `npm run build` before deploying.
 */
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("/recharts/") || id.includes("/d3-") || id.includes("/victory-vendor/")) return "charts";
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) return "react-vendor";
        },
      },
    },
  },
});
