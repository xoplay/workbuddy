/**
 * 主站收藏系统同步工具
 * 负责将游戏内获得的图片同步到主站数据库
 */

const API_BASE = '';

// 从主站 localStorage 获取 token（同源 iframe 共享）
function getToken(): string | null {
  try {
    return localStorage.getItem('xplay_token');
  } catch {
    return null;
  }
}

// girls-puzzle 格式 {prefix}_{level} → 主站格式 img/{prefix}/{prefix}{5位}.webp
// 新命名下 prefix 即文件夹名（a/b/c/d/e/f/g 等），路径与磁盘一致
export function toGlobalPath(prefix: string, level: number): string {
  const numStr = String(level).padStart(5, '0');
  return `img/${prefix}/${prefix}${numStr}.webp`;
}

// 主站格式 img/{prefix}/{prefix}{5位}.webp → girls-puzzle 格式 {prefix}_{level}
// 自引用（img/a/a00001.webp → prefix 'a'）；story 嵌套路径 img/s/01/... 由主站单独处理
export function fromGlobalPath(globalPath: string): { prefix: string; level: number } | null {
  const match = globalPath.match(/^img\/(?:tz\/)?([^/]+)\/\1(\d{5})\.webp$/);
  if (!match) return null;
  return { prefix: match[1], level: parseInt(match[2], 10) };
}

// ── API 调用 ──

/** 获取用户主站收藏列表 */
export async function fetchGlobalCollection(): Promise<string[]> {
  const token = getToken();
  if (!token) return [];

  try {
    const resp = await fetch(`${API_BASE}/api/collection/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.collection || []).map((c: { id: string }) => c.id);
  } catch {
    return [];
  }
}

/** 将具体图片添加到主站收藏 */
export async function addToGlobalCollection(prefix: string, level: number): Promise<boolean> {
  const token = getToken();
  if (!token) return false;

  const path = toGlobalPath(prefix, level);
  try {
    const resp = await fetch(`${API_BASE}/api/collection/unlock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ images: [path] }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/** 从主站图片池随机抽取（游戏内奖励用） */
export async function drawFromGlobalPool(count = 1, prefix?: string): Promise<string[]> {
  const token = getToken();
  if (!token) return [];

  try {
    const resp = await fetch(`${API_BASE}/api/collection/draw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ count, prefix }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.drawn || [];
  } catch {
    return [];
  }
}

/** 批量添加到主站收藏 */
export async function batchAddToGlobalCollection(items: { prefix: string; level: number }[]): Promise<string[]> {
  const token = getToken();
  if (!token) return [];

  const paths = items.map((i) => toGlobalPath(i.prefix, i.level));
  try {
    const resp = await fetch(`${API_BASE}/api/collection/unlock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ images: paths }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.unlocked || [];
  } catch {
    return [];
  }
}

/** 从主站图册删除某张图（回收进 mall 图库，可再次购买） */
export async function removeFromGlobalCollection(prefix: string, level: number): Promise<boolean> {
  const token = getToken();
  if (!token) return false;

  const path = toGlobalPath(prefix, level);
  try {
    const resp = await fetch(`${API_BASE}/api/collection/remove`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ images: [path] }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}
