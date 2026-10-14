import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// 加载屏：先于 React 挂载启动（XP_Kit 由 xplay-kit.js 在 main.tsx 前已就绪；本项目独立运行时该库缺失，已加降级）
(() => {
  const XP = (window as any).XP_Kit;
  if (XP && XP.load) {
    XP.load({
      name: "Girls Puzzle",
      logo: "/games/girls-puzzle/girls-puzzle.svg",
      steps: ["加载游戏资源…", "初始化引擎…", "准备界面…"],
    });
  } else {
    // 共享库缺失时：手动启动加载屏动画，让 #xp-load 可见
    const crawl = (window as any).__xpLoadCrawl;
    if (crawl && crawl.stop) crawl.stop();
  }
})();

// 共享库缺失兜底：3.5s 内若 XP_Kit.loadClose 未触发，强制关闭加载屏，避免黑屏。
// 集成真共享库时（XP_Kit.loadClose 已就绪），此 watch 自然被提前触发，不影响。
setTimeout(() => {
  const XP = (window as any).XP_Kit;
  const loadEl = document.getElementById("xp-load");
  if (!loadEl) return;
  if (!XP || !XP.loadClose) {
    loadEl.style.transition = "opacity .3s";
    loadEl.style.opacity = "0";
    setTimeout(() => { loadEl.style.display = "none"; }, 320);
  }
}, 3500);

const rootEl = document.getElementById("root");
if (rootEl) rootEl.innerHTML = "";

createRoot(rootEl!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
