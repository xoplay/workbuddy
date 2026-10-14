# Girls Puzzle 拼图游戏 策划文档

---

## 一、项目架构

### 1.1 整体架构
- **前端**：React + TypeScript + Tailwind CSS
- **部署**：嵌入主站作为 iframe，路径 `/games/girls-puzzle/`
- **账号系统**：使用主站统一账号（JWT），同时保留本地游客模式

### 1.2 资源路径
- 图片资源：主站 `public/img/` 目录下的 `pg/`、`pr/`、`r/`、`x/`、`xx/`、`xxx/`、`t/`、`s/`、`v/`
- UI 图标：主站 `public/ui/`

---

## 二、关卡规则

### 2.1 关卡线与图片获取

| 关卡线 | 非浮动关图片 | 浮动关图片 |
|--------|-------------|-----------|
| normal（免费关） | pg 系列 | pr 系列 |
| ad（广告关） | r 系列 | x 系列 |
| 钻石关 | xx 系列 | xxx 系列 |

浮动关定义：关卡号为5的倍数（5, 10, 15, 20, 25...）

### 2.2 网格规格进阶

#### 普通关卡（非浮动关）
- 基础大小：3×3（9块）
- 上限：6×6（36块）
- 增长规则：每第26关基础+1

| 关卡范围 | 尺寸 |
|----------|------|
| 1-25 | 3×3 |
| 26-50 | 4×4 |
| 51-75 | 5×5 |
| 76+ | 6×6 |

#### 浮动关（每5关一个浮动）
- 基础加成：每5关+1
- 额外加成：每25关（5的倍数中也是25的倍数）额外+1，总计+2

| 浮动关 | 基础尺寸 | 浮动加成 | 最终尺寸 |
|--------|----------|----------|----------|
| 5, 10, 15, 20 | 3×3 | +1 | 4×4 |
| 25 | 3×3 | +2 | 5×5 |
| 30, 35, 40, 45 | 4×4 | +1 | 5×5 |
| 50 | 4×4 | +2 | 6×6 |
| 55, 60, 65, 70 | 5×5 | +1 | 6×6 |
| 75 | 5×5 | +2 | 7×7 |
| 80, 85, 90, 95 | 6×6 | +1 | 7×7 |
| 100 | 6×6 | +2 | 8×8 |

#### 每日挑战模式
- 前10关：6×6
- 中10关（11-20）：7×7
- 20关以后：8×8

### 2.3 收藏系统
- 通关获得图片后自动同步到主站收藏系统
- 游戏启动时从主站拉取收藏列表，合并到本地
- 本地存储：`localStorage` 中的 `xplay_collection_girls`

---

## 三、经济系统

### 3.1 钻石
- 与主站共享同一余额（`Users.diamond`）
- 可通过主站商城购买或游戏内获取

### 3.2 金币（coins）
- **各游戏独立**，不与主站或其他游戏互通
- 存储位置：`localStorage` 中的 `xpuz_wallet_v1`（或游戏自身 wallet state）
- 用途：游戏内道具购买、兑换
- 与钻石不同：金币仅在 girls-puzzle 内部流通

---

## 四、代码实现

### 4.1 网格尺寸计算（PuzzleBoard.tsx）
```typescript
const getGridDims = (lvl: number) => {
  if (prefix === 't') {
    if (lvl <= 10) return { rows: 6, cols: 6 };
    if (lvl <= 20) return { rows: 7, cols: 7 };
    return { rows: 8, cols: 8 };
  }
  let baseSize = 3 + Math.floor((lvl - 1) / 25);
  baseSize = Math.min(baseSize, 6);
  let floatSize = 0;
  if (lvl % 25 === 0) floatSize = 2;
  else if (lvl % 5 === 0) floatSize = 1;
  return { rows: Math.min(baseSize + floatSize, 8), cols: Math.min(baseSize + floatSize, 8) };
};
```

### 4.2 钻石同步工具（src/utils/api.ts）
```typescript
// 调用主站API增减钻石（全站共享）
import { updateDiamond, getDiamondBalance, isLoggedIn, getToken } from './utils/api';

// 消费钻石（如购买金币宝箱）
const result = await updateDiamond(-50, 'exchange_gold_chest');
if (result.success) {
  setWallet(prev => ({ ...prev, diamonds: result.data.after }));
}

// 购买钻石（需后续集成支付系统）
const result = await updateDiamond(100, 'shop_purchase_100diamonds');
```
- `getToken()`：从 `localStorage.xplay_token` 获取主站 JWT
- `isLoggedIn()`：检查是否已登录主站
- `updateDiamond(delta, reason)`：调用 `POST /api/economy/diamond`，成功后同步到 `localStorage.global_diamonds`
- `getDiamondBalance()`：从主站 `/api/economy/status` 获取当前钻石余额

### 4.3 收藏同步（collectionSync.ts）
```typescript
// 通关时同步到主站
await addToGlobalCollection(prefix, level);

// 游戏启动时从主站拉取
const globalPaths = await fetchGlobalCollection();
```

---

## 五、图片资源规范

### 5.1 路径格式
- 本地：`/img/{prefix}/{prefix}{5位序号}.webp`
- 示例：`/img/pg/pg00001.webp`

### 5.2 无远程 fallback
- 所有图片必须本地存在，不存在则显示空白
- 不使用 Unsplash 等远程图片兜底

---

## 六、版本历史

### v1.0（初始版本）
- 基础拼图玩法
- 本地收藏系统

### v1.1（主站整合版）
- 接入主站统一账号系统
- 收藏同步到主站数据库
- 钻石全站共享（通过 `POST /api/economy/diamond` API）
- 金币保持游戏独立（不与主站互通）
- 统一拼图尺寸规则（与story一致）
