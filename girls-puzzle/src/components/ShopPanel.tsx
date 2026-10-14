/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * girls-puzzle 商城：改为直接挂载共享库 XP_Kit.shop（单一事实来源）。
 * 视频 / 故事套图 / 兑换券 / 自定义钻石输入全部移除（用户决定）。
 * 仅保留：去广告、钻石档（usd 测试期本地到账）、金币兑换（钻石→金币）。
 */

import React, { useEffect, useRef } from 'react';
import { UserWallet } from '../types';

interface ShopPanelProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: UserWallet;
  setWallet: React.Dispatch<React.SetStateAction<UserWallet>>;
}

export default function ShopPanel({ isOpen, onClose, wallet, setWallet }: ShopPanelProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const walletRef = useRef(wallet);
  walletRef.current = wallet;

  useEffect(() => {
    if (!isOpen) return;
    const xp = (typeof window !== 'undefined') && (window as any).XP_Kit;
    const mount = mountRef.current;
    if (!xp || !mount) return;

    const toast = (msg: string) => {
      const X = (window as any).XPlay;
      if (X && X.XP_Toast) X.XP_Toast.show(msg);
      else console.log(msg);
    };

    // 商城内容（图标/标题/文案/成本/hint）全部由共享库 DEF_SHOP_ITEMS 单一事实来源提供，
    // 这里只注入 girls 的私有购买动作。
    const handlers = {
      onNoAds: () => { localStorage.setItem('xpuz_no_ads_active', 'true'); toast('已永久去除广告'); },
      onDiamond: (amt: number) => { setWallet((p) => ({ ...p, diamonds: p.diamonds + amt })); },
      onSpendDiamond: (amt: number) => {
        if (walletRef.current.diamonds < amt) return false;
        setWallet((p) => ({ ...p, diamonds: p.diamonds - amt }));
        return true;
      },
      onGrantGold: (amt: number) => { setWallet((p) => ({ ...p, coins: p.coins + amt })); },
    };

    const ctrl = xp.shop(mount, {
      title: '商城',
      onBack: onClose,
      resbar: () => ({ coins: walletRef.current.coins, diamonds: walletRef.current.diamonds }),
      handlers,
    });

    return () => {
      if (ctrl && ctrl.root) ctrl.root.innerHTML = '';
    };
  }, [isOpen, onClose, setWallet]);

  if (!isOpen) return null;
  return (
    <div
      ref={mountRef}
      className="xp-page"
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#000' }}
    />
  );
}
