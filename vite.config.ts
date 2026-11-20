/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// `npm run build`        -> normál, többfájlos build (pl. Firebase Hosting / Netlify).
// `npm run build:single` -> egyetlen HTML fájl (demó link, offline bemutató).
export default defineConfig(({ mode }) => ({
  // relatív útvonalak: így a GitHub Pages alkönyvtárában (/happy-hour-detector/) is működik
  base: "./",
  plugins: mode === "single" ? [react(), viteSingleFile()] : [react()],
  build: {
    outDir: mode === "single" ? "dist-single" : "dist",
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: "node",
  },
}));
