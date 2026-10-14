/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 钻石全站统一走共享库 XP_Diamond（window.XPlay.XP_Diamond），
// 与 star / story / meow 完全一致：登录态经主站 /api/economy/diamond 增减，
// 未登录则本地回退（全局 key global_diamonds）。

const getXD = (): any => {
  try {
    return (window as any).XPlay?.XP_Diamond || null;
  } catch {
    return null;
  }
};

/** 是否已登录主站（持有 xplay_token）。 */
export function isLoggedIn(): boolean {
  return !!getXD()?.isLoggedIn?.();
}

/**
 * 增减钻石：委托共享库 XP_Diamond。
 * 返回 { success, data?: { after }, error? }，与既有调用方契约一致。
 */
export async function updateDiamond(
  delta: number,
  reason?: string
): Promise<{ success: boolean; error?: string; data?: any }> {
  const XD = getXD();
  if (!XD) {
    return { success: false, error: '共享库未就绪' };
  }
  try {
    const r = await XD.change(delta);
    return { success: r.success, data: { after: r.after } };
  } catch (e: any) {
    return { success: false, error: e?.message || '网络错误' };
  }
}
