import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "../extension",
    emptyOutDir: true,
    sourcemap: false,
    target: "es2020",
    minify: "esbuild",
    rollupOptions: {
      input: {
        "content-scripts/base": resolve("src/content-scripts/base.ts"),
        "content-scripts/site": resolve("src/content-scripts/site.ts"),
        "content-scripts/search": resolve("src/content-scripts/search.ts"),
        "page-world/map-loader": resolve("src/page-world/map-loader.ts")
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "shared/[name].js",
        assetFileNames: "assets/[name][extname]"
      }
    }
  }
});
