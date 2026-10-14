/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 挂载共享库 XP_Kit.settlement（story/meow 同款布局，单一事实来源）。
 * 结算「布局」(按钮/资源条位置大小) 来自共享库；差异点在「全屏奖励图来源」——
 * girls 与 meow/story 一致：奖励图 = 拼图完成的那张图（getStageImage 即插拔 image）。
 * 解锁/下载走广告门槛（onCollect/onDownload 钩子注入）。
 */

import React, { useRef, useState, useEffect } from 'react';
import { getStageImage } from '../utils/imageRegistry';

interface VictoryOverlayProps {
  prefix: string;
  level: number;
  onHome: () => void;
  onNext?: () => void;
  onUnlockCollection: () => void;
  onDownloadImage: () => void;
  isUnlockedInCollection: boolean;
  rewardInfo: { amount: number; line: 'normal' | 'ad' | 'premium' };
  onDoubleRewards: () => void;
  doubleClaimed: boolean;
  wallet: { coins: number; diamonds: number };
}

export default function VictoryOverlay({
  prefix,
  level,
  onHome,
  onNext,
  onUnlockCollection,
  onDownloadImage,
  isUnlockedInCollection,
  rewardInfo,
  onDoubleRewards,
  doubleClaimed,
  wallet,
}: VictoryOverlayProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [isDownloaded, setIsDownloaded] = useState(false);

  // 最新回调存进 ref，避免 kit 闭包捕获到过期值，也避免父组件重渲染时反复重建
  const cbRef = useRef({ onHome, onNext, onUnlockCollection, onDoubleRewards, onDownloadImage });
  cbRef.current = { onHome, onNext, onUnlockCollection, onDoubleRewards, onDownloadImage };

  useEffect(() => {
    const root = hostRef.current;
    const kit = (window as any).XP_Kit;
    if (!root || !kit || !kit.settlement) return;

    kit.settlement(root, {
      // 全屏奖励图：可插拔。girls/meow/story 都是「拼图完成的图」。
      image: getStageImage(prefix, level).local,
      coins: wallet.coins,
      diamonds: wallet.diamonds,
      rewardAmount: doubleClaimed ? rewardInfo.amount * 2 : rewardInfo.amount,
      doubleClaimed,
      onDouble: () => cbRef.current.onDoubleRewards(),
      onHome: () => cbRef.current.onHome(),
      onCollect: () => cbRef.current.onUnlockCollection(),
      isUnlocked: isUnlockedInCollection,
      onDownload: () => { setIsDownloaded(true); cbRef.current.onDownloadImage(); },
      isDownloaded,
      onNext: cbRef.current.onNext,
      nextLevel: level + 1,
      // girls 拼图无逐图标题元数据，信息块留空（与 story imageName||'' 行为一致，不渲染）。
      name: '',
      desc: '',
    });

    return () => { if (root) root.innerHTML = ''; };
  }, [
    prefix, level, wallet.coins, wallet.diamonds, rewardInfo.amount,
    doubleClaimed, isUnlockedInCollection, isDownloaded,
  ]);

  return (
    <div
      ref={hostRef}
      className="xp-settlement"
      style={{ position: 'fixed', inset: 0, zIndex: 60 }}
    />
  );
}
