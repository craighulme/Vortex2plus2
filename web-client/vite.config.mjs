import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/boot.ts",
      name: "Vortex2Plus2Runtime",
      formats: ["iife"],
      fileName: () => "boot.iife.js"
    },
    outDir: "../runtime",
    emptyOutDir: true,
    sourcemap: false,
    target: "es2022",
    minify: "esbuild",
    rollupOptions: {
      output: {
        extend: true,
        inlineDynamicImports: true
      }
    }
  },
  define: {
    __VWEB_RUNTIME_VERSION__: JSON.stringify("0.1.0")
  }
});
