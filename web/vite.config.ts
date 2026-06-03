import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves the app from https://<user>.github.io/<repo>/.
// Set VITE_BASE to "/<repo>/" at build time (the deploy workflow does this).
// Locally it defaults to "/".
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || "/",
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
