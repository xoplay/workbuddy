# Girls Puzzle 开发计划与规则细则（plan）

> 本文档为开发向，定义游戏规则权威细则、技术接入与变更记录。
> 玩家向完整介绍（含操作、基本功能）见 `md/girls.md`。

## 1. 游戏概述
经典拼图：交换图块复原精美图片。含收集线（玩法线 a~f + 挑战 g）、每日挑战、成就系统。难度多档，海量图片。

## 2. 核心规则（权威定义）
- 玩法：点击/拖拽交换两个图块，将全部图块还原到正确位置即获胜。
- 限制：步数有限，用完则本局失败（可重试/用道具）。
- 道具：撤回、提示、一键过关。
- 收集线：玩法线 a~f + 挑战 g（无视频/套图专辑；v/s 过滤与字幕已移除）。

## 3. 系统细则
### 3.1 关卡生成
- 图片按难度切片为 m×n 网格（如 3×3 / 4×4 / 5×5）。
- 收藏/图册：仅展示自身收藏（卡槽限制、耗金币）；删除需主站↔游戏内双向同步。

### 3.2 胜利/失败判定
- 全部图块归位即胜；步数耗尽即失败（可用一键过关道具）。

### 3.3 结算
- 使用共享库 `XP_Kit.settlement`（按钮布局、激励统一）；保留拼图完成反馈动画。

### 3.4 资源（货币）
- 钻石：全局 `XP_Diamond`（`global_diamonds` + 登录同步主站 `/api/economy/diamond`，未登录本地回退）。
- 金币：girls 内部状态，不参与跨游戏经济。

### 3.5 商城
- 使用共享库 `XP_Kit.shop`（去广告 + 钻石包 + 金币；**无视频/套图/券**）；items 单页、长按连买（仅钻石按钮）。

### 3.6 活动
- 使用共享库 `XP_Kit.activity`（签到 / 转盘 `XP_Kit.wheel` / 挑战）；活动页转盘统一为 girls 同款。

### 3.7 收藏
- 收集线 a~f + 挑战 g；无视频预览、无套图专辑；第 7 天签到与转盘 0.1% 改为 +20 钻石（原送券已去除）。

### 3.8 广告
- 使用共享库 `XP_Ads`（`XP_Ads.watch` 薄壳；跳过→cancel，看完→success）。

### 3.9 图标规范（全局铁律）
- 所有图标只用 `public/ui/*.svg`，缺失则新增；严禁外部字体图标（material-*），避免离线 ligature 退化成文字。

## 4. 共享库接入清单
- 引入：`/css/xplay-ui.css` + `/js/xplay-core.js` + `/xplay-kit/xplay-kit.js`
- 调用：`window.XP_Kit.*`、`window.XPlay.*`
- 注：首页「样式布局」复用共享库类（`.xp-enter-btn` 等），但三屏轮播为自研消费共享类，不新增共享库模组。

## 5. 全局约束
- 9:16 竖屏锁（`100dvh` + 两侧黑边）。
- 资源根防盗链：`<meta name="referrer" content="no-referrer">`。

## 6. 图片资产现状（2026-09-21 核对）
girls 图片走跨游戏共享库 `XP.Images`（`/img/manifest.json`），路径模板 `/img/{tier}/{tier}{n}.webp`。
girls 实际可读 tier：`a`(公开) `b`(精选) `c/d/e/f`(精品) `g`(挑战) 共 7 个池（manifest 定义，readableBy 含 girls）。

**【致命】当前 7 个 tier 主图目录（`/img/a` … `/img/g`）在 `public/img/` 下均不存在，0 张落地。**
- `getStageImage` 仅生成主图路径且 `local===fallback`（同一 404 路径），`PuzzleBoard.handleImageError` 无法降级 → 拼图源图全部裂图，**游戏当前不可正常玩**。
- `public/img/girls/` 为空目录（占位未用）。
- 原远程 Unsplash 方案已废弃（`getStageImage` 注释明确"不用任何远程 fallback"）。

**孤儿资产 / 死代码（已不被代码引用，待清理或决策）：**
- `src/utils/imageRegistry.ts` 的 `ART_LIBRARY`（a~g/v/s 的 Unsplash ID 全集）为纯死代码，全项目无任何 import 引用。
- `public/img/thumb/a/`（64 张）、`public/img/thumb/g/`（1 张）缩略图：girls 源码不含任何 `thumb` 引用，属早期方案残留孤儿。

**生产方案（上线前必做）：**
- 按 manifest path 模板 `/img/{tier}/{tier}{n}.webp` 落盘；基础素材量参考 `ART_LIBRARY` 预留 ID：a×10 b×8 c×7 d×6 e×6 f×5 g×7（合计 49 张起步；a 可扩至 64 以对齐 thumb 现有量）。
- 或从 `thumb/a` 的 64 张中提取/重采样为主图（需先确认分辨率满足拼图切片要求）。
- 商城主题包 `SHOP_THEME_PACKS.coverImage` 当前用 `getFallbackGradient` 渐变占位，待换真图。

## 7. 变更记录
- 2026-07：icon 全量统一到 `public/ui/*.svg`；结算改共享库 `XP_Kit.settlement`；商城换 `XP_Kit.shop`（去视频/套图/券）。
- 2026-07-26：死代码清理（types.ts 删 videoTickets/albumTickets/ShopPack；App.tsx 删 handlePurchaseThemePack/grantAlbumReward/28天全勤送套图块/activeShopTab；CollectionPanel 删 VIDEO_PREVIEWS/v/s 过滤）。
- 2026-09-21：核对图片资产——发现 7 个 tier 主图全部缺失（阻塞可玩）、`ART_LIBRARY` 死代码、`thumb` 孤儿资产；补充本 §6。
