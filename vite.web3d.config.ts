import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const SERVER_PORT = Number(process.env["SERVER_PORT"] ?? 5174);

export default defineConfig({
  root: "web3d",
  plugins: [react()],
  css: {
    transformer: "lightningcss",
  },
  server: {
    port: 5175,
    proxy: {
      "/api": `http://localhost:${SERVER_PORT}`,
    },
  },
  build: {
    outDir: "../dist/web3d",
    emptyOutDir: true,
    cssMinify: "lightningcss",
  },
});
