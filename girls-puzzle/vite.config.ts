import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// GitHub Pages 部署在子路径 /workbuddy/girls-puzzle/，生产构建需带 base；本地 dev 保持根路径
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/workbuddy/girls-puzzle/" : "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5174,
    host: "0.0.0.0",
  },
  preview: {
    port: 5174,
    host: "0.0.0.0",
    allowedHosts: true, // 允许经反代域名访问（线上预览/发布场景）
  },
}));
