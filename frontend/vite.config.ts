import { writeFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// In development the Go server runs on :8090 and owns /api.
const backend = process.env.FILEBROWSER_BACKEND ?? "http://localhost:8090";

// emptyOutDir wipes dist/.gitkeep, which go:embed needs in a fresh clone.
const keepDist: Plugin = {
  name: "keep-dist",
  apply: "build",
  closeBundle() {
    writeFileSync(fileURLToPath(new URL("./dist/.gitkeep", import.meta.url)), "");
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss(), keepDist],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    proxy: { "/api": backend },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    // Shiki grammars and Mermaid are split into lazy chunks; the large ones
    // only load when a file needs them.
    chunkSizeWarningLimit: 1024,
  },
});
