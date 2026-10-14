/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 挂载共享库 XP_Kit.collection（story 同款皮肤，单一事实来源）。
 * 不在 girls 复制收藏页结构/样式；游戏规则通过 collections→items、filters、
 * onDelete(双向同步主站)、onBuyCapacity(金币/钻石扩槽) 钩子注入。
 * 保留 girls 原有的筛选项持久化（xpuz_gallery_filter）。
 */

import React, { useRef, useEffect, useState } from 'react';
import { CollectionItem, GameSettings, UserWallet } from '../types';
import { getStageImage } from '../utils/imageRegistry';
import { isLoggedIn, updateDiamond } from '../utils/api';

interface CollectionPanelProps {
  isOpen: boolean;
  onClose: () => void;
  collections: CollectionItem[];
  onDeleteCollection: (id: string) => void;
  settings: GameSettings;
  setSettings: React.Dispatch<React.SetStateAction<GameSettings>>;
  wallet: UserWallet;
  setWallet: React.Dispatch<React.SetStateAction<UserWallet>>;
  showToast: (msg: string) => void;
}

const FILTERS = [
  { id: 'all', label: '全部' },
  { id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' },
  { id: 'd', label: 'D' }, { id: 'e', label: 'E' }, { id: 'f', label: 'F' },
  { id: 'g', label: 'G' },
];

export default function CollectionPanel({
  isOpen,
  onClose,
  collections,
  onDeleteCollection,
  settings,
  setSettings,
  wallet,
  setWallet,
  showToast,
}: CollectionPanelProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [activeFilter, setActiveFilter] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('xpuz_gallery_filter');
      if (saved && FILTERS.some(f => f.id === saved)) return saved;
    } catch (e) {}
    return 'all';
  });

  useEffect(() => {
    try { localStorage.setItem('xpuz_gallery_filter', activeFilter); } catch (e) {}
  }, [activeFilter]);

  // 最新回调/状态存进 ref，避免 kit 闭包捕获到过期值
  const cbRef = useRef({ onDeleteCollection, onClose, wallet, setWallet, settings, setSettings, showToast });
  cbRef.current = { onDeleteCollection, onClose, wallet, setWallet, settings, setSettings, showToast };

  useEffect(() => {
    if (!isOpen) return;
    const root = hostRef.current;
    const kit = (window as any).XP_Kit;
    if (!root || !kit || !kit.collection) return;

    const filtered = collections
      .filter(it => activeFilter === 'all'
        ? !['g'].includes(it.prefix)
        : it.prefix === activeFilter)
      .sort((a, b) => b.collectedAt - a.collectedAt);

    const items = filtered.map(it => {
      const img = getStageImage(it.prefix, it.level);
      return {
        id: it.id,
        prefix: it.prefix,
        level: it.level,
        src: img.local,
      };
    });

    const capacity = activeFilter === 'all' ? (settings.collectionCapacity || 20) : 0;

    const nextCost = capacity * 250;
    const buyLabel = `-${nextCost}`;

    const handleBuyCapacity = async () => {
      const nextCost = capacity * 250;
      if (cbRef.current.wallet.coins >= nextCost) {
        cbRef.current.setWallet(prev => ({ ...prev, coins: prev.coins - nextCost }));
        cbRef.current.setSettings(prev => ({ ...prev, collectionCapacity: (prev.collectionCapacity || 20) + 1 }));
        return;
      }
      const requiredCoins = nextCost - cbRef.current.wallet.coins;
      const diamondCost = Math.ceil(requiredCoins / 1000);
      if (cbRef.current.wallet.diamonds < diamondCost) { cbRef.current.showToast('diamond'); return; }
      if (!isLoggedIn()) { cbRef.current.showToast('请先登录主站账号'); return; }
      const result = await updateDiamond(-diamondCost, 'buy_collection_capacity');
      if (!result.success) { cbRef.current.showToast(result.error || '购买失败'); return; }
      cbRef.current.setWallet(prev => ({ ...prev, diamonds: result.data.after, coins: 0 }));
      cbRef.current.setSettings(prev => ({ ...prev, collectionCapacity: (prev.collectionCapacity || 20) + 1 }));
    };

    kit.collection(root, {
      count: filtered.length,
      capacity,
      items,
      filters: FILTERS,
      activeFilter,
      buyLabel,
      onFilter: (f: string) => setActiveFilter(f),
      onDelete: (id: string) => cbRef.current.onDeleteCollection(id),
      onBuyCapacity: handleBuyCapacity,
      onClose: cbRef.current.onClose,
    });

    return () => { if (root) root.innerHTML = ''; };
  }, [isOpen, activeFilter, collections, settings.collectionCapacity, wallet.coins, wallet.diamonds]);

  if (!isOpen) return null;
  return (
    <div
      ref={hostRef}
      className="xp-collection"
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#000' }}
    />
  );
}
