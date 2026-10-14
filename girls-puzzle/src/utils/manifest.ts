/**
 * 图片资源配置解析器（React 游戏版）
 * 自 2026-07-24 起直接复用跨游戏共享库 public/js/xplay-core.js 的 XP.Images
 * （window.XPlay.XP_Images）—— 单一代码路径 + 单一数据源（/img/manifest.json）。
 * 仅保留极薄兜底，避免共享库未就绪时图片 404。
 */

type Tier = { id: string; path?: string; readableBy?: string[]; [k: string]: any };

function xpImages(): any | null {
  try {
    const xp = (window as any).XPlay;
    return xp && xp.XP_Images ? xp.XP_Images : null;
  } catch {
    return null;
  }
}

// 共享库就绪后预热其 manifest 缓存（与其同源）
const _xp = xpImages();
if (_xp && _xp._load) {
  try { _xp._load(); } catch { /* ignore */ }
}

function pad5(n: number): string {
  const safe = isNaN(n) || typeof n !== 'number' ? 1 : n;
  return String(safe).padStart(5, '0');
}

/** 同步生成图片路径；优先用共享库（manifest 已加载），否则通用兜底 */
export function buildPathSync(tierId: string, n: number): string {
  const x = xpImages();
  if (x) {
    const p: string = x.buildPath(tierId, n);
    if (p) return p;
  }
  // 兜底：扁平 tier 文件夹名 == prefix（a/b/c/d/e/f/g/v）
  return `/img/${tierId}/${tierId}${pad5(n)}.webp`;
}

/** 某游戏允许读取的 tier 列表（manifest readableBy 包含该 gameId） */
export function tiersForGame(gameId: string): string[] {
  const x = xpImages();
  if (x) return (x.tiersForGameSync(gameId) || []).map((t: Tier) => t.id);
  return [];
}

/** 同步判断：该游戏能否读取某 tier（manifest 未加载时默认放行，避免误屏蔽） */
export function canReadSync(gameId: string, tierId: string): boolean {
  const x = xpImages();
  if (x) {
    const t: Tier | null = x.tierOf(tierId);
    if (!t) return true;
    const rb: string[] = t.readableBy || [];
    return rb.includes(gameId) || rb.includes('main');
  }
  return true;
}

/** 兼容旧调用：入口处触发一次 manifest 预热 */
export function ensureManifest(): Promise<any[]> {
  const x = xpImages();
  if (x && x._load) return x._load();
  return Promise.resolve([]);
}
// 导入即触发一次加载，尽量在用户进入拼图前就绪
ensureManifest();
