import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

const localPublic = path.resolve(__dirname, "public");
const monorepoPublic = path.resolve(__dirname, "../public");
const UPSTREAM = "https://staging.phantix.site";
const SANDBOX_APPLY = "http://127.0.0.1:8787";

export default defineConfig({
  plugins: [react()],
  publicDir: fs.existsSync(localPublic) ? localPublic : monorepoPublic,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5176,
    host: true,
    proxy: {
      "/api": {
        target: UPSTREAM,
        changeOrigin: true,
        secure: true,
        ws: true,
      },
      "/sandbox-apply": {
        target: SANDBOX_APPLY,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/sandbox-apply/, ""),
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          motion: ["framer-motion"],
          charts: ["recharts"],
        },
      },
    },
  },
});
