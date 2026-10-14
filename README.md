# WorkBuddy

WorkBuddy 项目仓库。

## 项目

| 目录 | 说明 | 状态 |
|------|------|------|
| [`girls-puzzle/`](./girls-puzzle) | Girls Puzzle 拼图游戏（React + TS + Tailwind v4） | 可运行 |

## girls-puzzle

经典拼图：交换图块复原图片，含关卡线、收藏、商城、每日挑战。

```bash
cd girls-puzzle
npm install
npm run dev      # http://localhost:5174
npm run build    # 类型检查 + 生产构建到 dist/
```

### 本次补全内容

原工程只有源码，缺失全部运行时资产，无法启动。已补齐：

- **构建配置**：`package.json` / `vite.config.ts` / `tsconfig` / `@` 路径别名
- **拼图图片 49 张**：`public/img/{a..g}/`，由 `tools/generate_images.py` 程序化生成（9:16，每 tier 一套风格）
- **UI 图标 13 个**：`public/ui/*.svg`
- **`src/config/assets.ts`**：`assetUrl()` 资源路径解析（原先被引用但文件缺失）
- **加载屏降级**：主站共享库缺失时 3.5s 强制关闭遮罩，避免黑屏
- **修复 3 处编译错误**：`canReadSync` / `removeFromGlobalCollection` 漏 import、`window.top` 空值

### 已知边界

- 主站共享库（`XP_Kit` / `XPlay`）为**可选依赖**。缺失时资源条、结算弹窗、商城、收藏面板等由共享库渲染的 UI 不显示；核心拼图玩法不受影响。接入真库后自动恢复。
- 拼图图片为程序化生成的占位图。换真图按 `public/img/{tier}/{tier}{n:05d}.webp` 命名覆盖即可，无需改代码。
- `imageRegistry.ts` 的 `ART_LIBRARY`（Unsplash ID 全集）为死代码，未清理（见 `girls-puzzle-plan.md` §6）。
