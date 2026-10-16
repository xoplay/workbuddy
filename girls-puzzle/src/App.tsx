/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play } from 'lucide-react';
import { StageLine, UserWallet, CollectionItem, GameSettings } from './types';
import { getStageImage, SHOP_THEME_PACKS } from './utils/imageRegistry';
import { playZenChime, triggerVibration } from './utils/audioSystem';
import { addToGlobalCollection, drawFromGlobalPool, fetchGlobalCollection, fromGlobalPath, removeFromGlobalCollection } from './utils/collectionSync';
import { canReadSync } from './utils/manifest';
import PuzzleBoard from './components/PuzzleBoard';
import VictoryOverlay from './components/VictoryOverlay';
import ShopPanel from './components/ShopPanel';
import CollectionPanel from './components/CollectionPanel';
import DailyFeaturesPanel, { DailyFeaturesState } from './components/DailyFeaturesPanel';
import { GuideOverlay } from './components/GuideOverlay';


import { fxSystem } from './utils/fxSystem';
import { assetUrl } from './config/assets';

// 共享内联 SVG 图标（window.XPlay.XP_Icons）：统一视觉，零图片依赖
type XpIconName = 'coin' | 'diamond' | 'star' | 'like' | 'home' | 'download' | 'back' | 'close' | 'ad';
function xpIconSvg(name: XpIconName): string | null {
  try { const svg: string | undefined = (window as any).XPlay?.XP_Icons?.[name]; return svg || null; } catch { return null; }
}
function XpIcon({ name, className = 'w-5 h-5' }: { name: XpIconName; className?: string }) {
  const svg = xpIconSvg(name);
  if (!svg) return null;
  return (
    <span className={`inline-block shrink-0 ${className}`} style={{ lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: svg.replace('<svg ', '<svg style="width:100%;height:100%;display:block" ') }} />
  );
}

/* 全局资源条薄壳：渲染交给共享库 XP_Kit.resbar（单一事实来源），数值变化走 ctrl.set 原地更新 */
function GlobalResbar({ coins, diamonds, onClick }: { coins: number; diamonds: number; onClick: () => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const ctrlRef = React.useRef<{ set: (c: number, d: number) => void } | null>(null);
  useEffect(() => {
    const root = ref.current;
    const kit = (window as any).XP_Kit;
    if (!root || !kit || !kit.resbar) return;
    ctrlRef.current = kit.resbar(root, { coins, diamonds });
    return () => { ctrlRef.current = null; if (root) { root.innerHTML = ''; root.classList.remove('xp-resbar'); } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { ctrlRef.current?.set(coins, diamonds); }, [coins, diamonds]);
  return <div ref={ref} onClick={onClick} className="z-40 cursor-pointer pointer-events-auto" />;
}

const LOCAL_STORAGE_KEY_WALLET = 'xpuz_user_wallet_v1';
const LOCAL_STORAGE_KEY_STAGE = 'xpuz_stage_state_v1';
const LOCAL_STORAGE_KEY_COLLECTION = 'xpuz_collection_v1';
const LOCAL_STORAGE_KEY_SETTINGS = 'xpuz_settings_v1';
const LOCAL_STORAGE_KEY_DAILY_FEATURES = 'xpuz_daily_features_v1';

export default function App() {
  // ----------------------------------------------------
  // 1. App-level state (wallets, progression, databases)
  // ----------------------------------------------------
  useEffect(() => {
    const unsub = fxSystem.subscribe((evt) => {
      if (evt.onFinish) evt.onFinish();
    });
    return unsub;
  }, []);


  const [wallet, setWallet] = useState<UserWallet>(() => {
    let initialWallet = { coins: 1000, diamonds: 5000 };
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_WALLET);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.coins === 'number' && typeof parsed.diamonds === 'number' && true) {
          initialWallet = parsed;
        }
      }
    } catch (e) {
      console.error("Failed to parse wallet state", e);
    }

    // Sync with global resources
    const globalDiamonds = localStorage.getItem('global_diamonds');
    if (globalDiamonds) {
      initialWallet.diamonds = parseInt(globalDiamonds, 10);
    }

    return initialWallet;
  });

  const [stages, setStages] = useState<Record<StageLine, { level: number; clearedLevel: number }>>(() => {
    const defaultStages = {
      normal: { level: 1, clearedLevel: 0 },
      ad: { level: 1, clearedLevel: 0 },
      premium: { level: 1, clearedLevel: 0 },
    };
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_STAGE);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.normal && parsed.ad && parsed.premium) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Failed to parse stages state", e);
    }
    return defaultStages;
  });

  const [collections, setCollections] = useState<CollectionItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_COLLECTION);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("Failed to parse collections state", e);
    }
    return [];
  });

  const [settings, setSettings] = useState<GameSettings>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_SETTINGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.soundEnabled === 'boolean') {
          return { ...parsed, collectionCapacity: parsed.collectionCapacity ?? 20 };
        }
      }
    } catch (e) {
      console.error("Failed to parse settings", e);
    }
    return { soundEnabled: true, musicEnabled: true, vibrationEnabled: true, collectionCapacity: 20 };
  });

  const [dailyFeatures, setDailyFeatures] = useState<DailyFeaturesState>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_DAILY_FEATURES);
      if (saved) return JSON.parse(saved);
    } catch (e) { console.error(e); }
    return {
      signInData: { lastDate: '', consecutiveDays: 0 },
      challengeData: { monthYear: '', completedDays: [], adResigns: 0, diamondResigns: 0 },
      wheelData: { lastDate: '', freeSpins: 1, adSpins: 2 }
    };
  });

  // ----------------------------------------------------
  // 2. Navigation & Panel triggers
  // ----------------------------------------------------
  const [appState, setAppState] = useState<'home' | 'play' | 'win'>('home');
  const [activeLine, setActiveLine] = useState<StageLine>('normal');
  const [activeChallengeDay, setActiveChallengeDay] = useState<number | null>(null);
  const [currentScreen, setCurrentScreen] = useState<-1 | 1 | 2>(1); // Index: -1 (Ad), 1 (Normal), 2 (Premium)
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(() => {
    try {
      return localStorage.getItem('girls_puzzle_guide_seen') !== 'true';
    } catch(e) { return true; }
  });
  const [isDailyOpen, setIsDailyOpen] = useState(false);

  // 加载屏：首屏挂载完成后关闭（与 meow 同款）
  useEffect(() => {
    const XP = (window as any).XP_Kit;
    if (XP && XP.loadClose) XP.loadClose();
  }, []);

  // Swipe gesture tracking (touch + mouse drag)
  const touchStartXRef = useRef<number | null>(null);
  const touchEndXRef = useRef<number | null>(null);
  const [mouseStartX, setMouseStartX] = useState<number | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.targetTouches[0].clientX;
    touchEndXRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndXRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartXRef.current === null || touchEndXRef.current === null) return;
    const distance = (touchStartXRef.current || 0) - (touchEndXRef.current || 0);
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      if (currentScreen === -1) {
        setCurrentScreen(1);
        playZenChime(300, 'sine', 0.1, 0.05);
      } else if (currentScreen === 1) {
        setCurrentScreen(2);
        playZenChime(300, 'sine', 0.1, 0.05);
      }
    } else if (isRightSwipe) {
      if (currentScreen === 2) {
        setCurrentScreen(1);
        playZenChime(300, 'sine', 0.1, 0.05);
      } else if (currentScreen === 1) {
        setCurrentScreen(-1);
        playZenChime(300, 'sine', 0.1, 0.05);
      }
    }

    touchStartXRef.current = null;
    touchEndXRef.current = null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only pay attention to left mouse clicking
    if (e.button !== 0) return;
    setMouseStartX(e.clientX);
    setIsMouseDown(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isMouseDown) return;
  };

  const handleMouseUpOrLeave = (e: React.MouseEvent) => {
    if (!isMouseDown || mouseStartX === null) return;
    const distance = mouseStartX - e.clientX;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      if (currentScreen === -1) {
        setCurrentScreen(1);
        playZenChime(300, 'sine', 0.1, 0.05);
      } else if (currentScreen === 1) {
        setCurrentScreen(2);
        playZenChime(300, 'sine', 0.1, 0.05);
      }
    } else if (isRightSwipe) {
      if (currentScreen === 2) {
        setCurrentScreen(1);
        playZenChime(300, 'sine', 0.1, 0.05);
      } else if (currentScreen === 1) {
        setCurrentScreen(-1);
        playZenChime(300, 'sine', 0.1, 0.05);
      }
    }

    setMouseStartX(null);
    setIsMouseDown(false);
  };

  // ----------------------------------------------------
  // 3. Custom action parameters for ads
  // ----------------------------------------------------
  const [shouldAddSteps, setShouldAddSteps] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // 全站唯一广告入口：上线接广告只需改 xplay-core.js 的 XP_Ads.watch
  const watchAd = (title: string, onDone: () => void) => {
    const A = (window as any).XPlay && (window as any).XPlay.XP_Ads;
    if (A && typeof A.watch === 'function') {
      A.watch({ title, sub: title }).then(() => { try { onDone(); } catch (e) {} });
    } else {
      try { onDone(); } catch (e) {}
    }
  };

  const triggerAdForFeature = (callback: () => void) => {
    watchAd('福利', () => { try { callback(); } catch (e) {} });
  };

  const onLaunchChallenge = (day: number) => {
    setActiveChallengeDay(day);
    setActiveLine('normal'); // safe default
    setAppState('play');
    playZenChime(400, 'sine', 0.1, 0.05);
  };

  // ----------------------------------------------------
  // 4. Persistence watchers
  // ----------------------------------------------------
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_WALLET, JSON.stringify(wallet));
      localStorage.setItem('global_diamonds', wallet.diamonds.toString());
    } catch (e) {
      console.warn("Storage write restricted or unavailable in private/iframe frame", e);
    }
  }, [wallet]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_STAGE, JSON.stringify(stages));
    } catch (e) {
      console.warn("Storage write restricted or unavailable in private/iframe frame", e);
    }
  }, [stages]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_COLLECTION, JSON.stringify(collections));
    } catch (e) {
      console.warn("Storage write restricted or unavailable in private/iframe frame", e);
    }
  }, [collections]);

  // 游戏启动时从主站同步收藏列表
  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      const globalPaths = await fetchGlobalCollection();
      if (cancelled || globalPaths.length === 0) return;

      setCollections((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const newItems: CollectionItem[] = [];
        for (const path of globalPaths) {
          const parsed = fromGlobalPath(path);
          if (!parsed) continue;
          // 只合并本游戏可读的 tier（story 01-08 等不在此列）
          if (!canReadSync('girls-puzzle', parsed.prefix)) continue;
          const id = `${parsed.prefix}_${parsed.level}`;
          if (!existingIds.has(id)) {
            newItems.push({
              id,
              prefix: parsed.prefix,
              level: parsed.level,
              collectedAt: Date.now(),
            });
          }
        }
        if (newItems.length > 0) {
          return [...newItems, ...prev];
        }
        return prev;
      });
    };
    // 延迟1秒执行，等待token可能从主站传入
    const timer = setTimeout(sync, 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_DAILY_FEATURES, JSON.stringify(dailyFeatures));
    } catch (e) {
      console.warn("Storage write restricted or unavailable in private/iframe frame", e);
    }
  }, [dailyFeatures]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.warn("Storage write restricted or unavailable in private/iframe frame", e);
    }
  }, [settings]);

  // Toast auto-clear
  useEffect(() => {
    if (feedbackToast) {
      const t = setTimeout(() => setFeedbackToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [feedbackToast]);

  const triggerToast = (msg: string) => {
    // Disabled text toasts to avoid internationalization issues as requested
  };

  // ----------------------------------------------------
  // 5. Image & Size resolving logic
  // ----------------------------------------------------
  const getStageTotalPieces = (line: StageLine, lvl: number) => {
    const safeLvl = isNaN(lvl) || typeof lvl !== 'number' ? 1 : lvl;
    let baseSize = 3 + Math.floor((safeLvl - 1) / 25);
    baseSize = Math.min(baseSize, 6);
    
    let floatSize = 0;
    if (safeLvl % 10 === 0) {
      floatSize = 2;
    } else if (safeLvl % 5 === 0) {
      floatSize = 1;
    }
    
    const size = Math.min(baseSize + floatSize, 8);
    return size * size;
  };

  const getStagePrefix = (line: StageLine, lvl: number) => {
    const safeLvl = isNaN(lvl) || typeof lvl !== 'number' ? 1 : lvl;
    const isFloat = safeLvl % 3 === 0;
    if (line === 'normal') return isFloat ? 'b' : 'a';
    if (line === 'ad') return isFloat ? 'd' : 'c';
    return isFloat ? 'f' : 'e';
  };

  // ----------------------------------------------------
  // 6. Action Handlers
  // ----------------------------------------------------

  const [doubleClaimed, setDoubleClaimed] = useState(false);

  // Play button on Home Carousel clicked
  const handleHomePlayClick = (specificLine?: StageLine) => {
    playZenChime(440, 'sine', 0.1, 0.05);
    const line = specificLine || (currentScreen === 1 ? 'normal' : currentScreen === -1 ? 'ad' : 'premium');

    // Always clear challenge state when starting a normal game
    setActiveChallengeDay(null);

    if (line === 'normal') {
      // Normal: always free
      setActiveLine('normal');
      setDoubleClaimed(false);
      setAppState('play');
    } else if (line === 'ad') {
      // Ad Stage: Verify unlocking hurdle
      setActiveLine('ad');
      setDoubleClaimed(false);
      // Trigger watch-ad flow to acquire immediate ticket
      watchAd(`Unlock Ad Stage Level ${stages.ad?.level ?? 1}`, () => {
        triggerToast('Ad Stage Unlocked! Enjoy.');
        setAppState('play');
      });
    } else if (line === 'premium') {
      // Premium Stage: Verify diamond ticket price
      const activeLvl = stages.premium?.level ?? 1;
      const totalPieces = getStageTotalPieces('premium', activeLvl);
      const ticketCost = Math.round(totalPieces * 1.5 + Math.pow(totalPieces, 1.5) * 0.4);

      if (wallet.diamonds >= ticketCost) {
        // Spend ticket immediately
        setWallet((prev) => ({ ...prev, diamonds: prev.diamonds - ticketCost }));
        setActiveLine('premium');
        setDoubleClaimed(false);
        triggerVibration(settings.vibrationEnabled, 50);
        setAppState('play');
      } else {
        // Insufficient diamonds feedback
        triggerToast('Need Diamonds! Trade Gold Coins in the Shop.');
        setIsShopOpen(true);
      }
    }
  };

  // Triggering Revive ad watch from failed panel
  const handleReviveStepsAdRequest = () => {
    watchAd('复活 +3步', () => {
      triggerToast('Steps Revived (+3)');
      setShouldAddSteps(true);
    });
  };


  // Double reward triggering
  const doubleVictoryPayout = () => {
    if (doubleClaimed) return;
    const rewardInfo = getVictoryRewardInfo();

    if (activeLine === 'normal') {
      setWallet((prev) => ({ ...prev, coins: prev.coins + rewardInfo.amount }));
      triggerToast(`Double Claimed! +${rewardInfo.amount} Gold Coins`);
    } else if (activeLine === 'ad' || activeLine === 'premium') {
      setWallet((prev) => ({ ...prev, coins: prev.coins + rewardInfo.amount }));
      triggerToast(`Double Claimed! +${rewardInfo.amount} Gold Coins`);
    }
    setDoubleClaimed(true);
  };

  // Save current solved image to gallery database
  const saveActiveToCollections = async () => {
    let lvl: number;
    let prefix: string;
    if (activeChallengeDay !== null) {
      lvl = activeChallengeDay;
      prefix = 'g';
    } else {
      const activeStage = stages[activeLine] || { level: 1 };
      lvl = activeStage.level ?? 1;
      prefix = getStagePrefix(activeLine, lvl);
    }
    const itemID = `${prefix}_${lvl}`;

    // Verify duplication
    if (collections.some((c) => c.id === itemID)) {
      triggerToast('This artwork already rests in your gallery.');
      return;
    }

    const newItem: CollectionItem = {
      id: itemID,
      prefix,
      level: lvl,
      collectedAt: Date.now(),
    };

    // 同步到主站收藏系统
    const synced = await addToGlobalCollection(prefix, lvl);
    if (synced) {
      triggerToast('Masterwork added to Collection Galerie!');
    } else {
      triggerToast('Saved locally (sync pending)');
    }

    setCollections((prev) => [newItem, ...prev]);
  };

  // Download high-resolution art asset direct to desktop/storage
  const downloadActiveMasterArt = async () => {
    let lvl: number;
    let prefix: string;
    
    if (activeChallengeDay !== null) {
      lvl = activeChallengeDay;
      prefix = 'g';
    } else {
      const activeStage = stages[activeLine] || { level: 1 };
      lvl = activeStage.level ?? 1;
      prefix = getStagePrefix(activeLine, lvl);
    }
    
    const imgData = getStageImage(prefix, lvl);

    triggerToast('Preparing high-resolution file download...');

    try {
      const response = await fetch(imgData.local);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = `xpuzzle_${prefix}${lvl}.jpg`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(blobUrl);
      triggerToast('Masterpiece saved to your local device!');
    } catch (e) {
      // CORS fallback trigger popup window
      window.open(imgData.local, '_blank');
      triggerToast('Loaded high-resolution art inside new window.');
    }
  };

  // Delete/Clear collections item cache memory
  const handleDeleteCollectionItem = (id: string) => {
    setCollections((prev) => prev.filter((c) => c.id !== id));
    // 同步删除到主站图册（回收进 mall 图库，可再次购买）
    const idx = id.indexOf('_');
    if (idx > 0) {
      const prefix = id.slice(0, idx);
      const level = parseInt(id.slice(idx + 1), 10);
      if (!isNaN(level)) removeFromGlobalCollection(prefix, level).catch(() => {});
    }
    triggerToast('Local picture cache released.');
  };

  // Finish stage solved
  const handlePuzzleBoardVictory = () => {
    if (activeChallengeDay !== null) {
      // Challenge Victory
      setDailyFeatures(prev => {
        if (!prev.challengeData.completedDays.includes(activeChallengeDay)) {
          const newCompleted = [...prev.challengeData.completedDays, activeChallengeDay].sort((a,b)=>a-b);

          return {
            ...prev,
            challengeData: { ...prev.challengeData, completedDays: newCompleted }
          };
        }
        return prev;
      });

      setAppState('win');
      setTimeout(() => {
        fxSystem.spawn({ sourceId: 'victory-reward-btn', targetIcon: 'coin', amount: 2000, onFinish: () => {
          setWallet((prev) => ({ ...prev, coins: prev.coins + 2000 }));
          triggerToast('挑战成功，获取 2000 金币！');
        } });
      }, 500);
      return;
      
      setDoubleClaimed(false);
      setAppState('win'); // Note: VictoryOverlay might need handling for `ch` prefix
      return;
    }

    // Distribute basic yield instantly
    const activeStage = stages[activeLine] || { level: 1 };
    const lvl = activeStage.level ?? 1;
    const pieces = getStageTotalPieces(activeLine, lvl);
    
    let rewardCount = 0;
    if (activeLine === 'normal') rewardCount = pieces * 100;
    if (activeLine === 'ad') rewardCount = pieces * 150;
    if (activeLine === 'premium') rewardCount = pieces * 200;

    setWallet((prev) => {
      return { ...prev, coins: prev.coins + rewardCount };
    });

    setDoubleClaimed(false);
    setAppState('win');
  };

  // Proceeding to the immediately next level in sequence
  const handleAdvanceToNextStage = () => {
    const activeStage = stages[activeLine] || { level: 1, clearedLevel: 0 };
    const currentLvl = activeStage.level ?? 1;
    const currentCleared = activeStage.clearedLevel ?? 0;
    const nextLvl = currentLvl + 1;

    if (activeLine === 'normal') {
      setStages((prev) => ({
        ...prev,
        [activeLine]: { level: nextLvl, clearedLevel: Math.max(currentCleared, currentLvl) },
      }));
      setDoubleClaimed(false);
      setAppState('play');
      playZenChime(523.25, 'sine', 0.1, 0.05);
    } else if (activeLine === 'ad') {
      watchAd(`Unlock Ad Stage Level ${nextLvl}`, () => {
        setStages((prev) => ({
          ...prev,
          [activeLine]: { level: nextLvl, clearedLevel: Math.max(currentCleared, currentLvl) },
        }));
        setDoubleClaimed(false);
        setAppState('play');
      });
    } else if (activeLine === 'premium') {
      const totalPieces = getStageTotalPieces('premium', nextLvl);
      const ticketCost = Math.round(totalPieces * 1.5 + Math.pow(totalPieces, 1.5) * 0.4);
      if (wallet.diamonds >= ticketCost) {
        setWallet((prev) => ({ ...prev, diamonds: prev.diamonds - ticketCost }));
        setStages((prev) => ({
          ...prev,
          [activeLine]: { level: nextLvl, clearedLevel: Math.max(currentCleared, currentLvl) },
        }));
        setDoubleClaimed(false);
        setAppState('play');
        triggerVibration(settings.vibrationEnabled, 50);
      } else {
        triggerToast('Need Diamonds for Next Level! Trade Gold in the Shop.');
        setIsShopOpen(true);
      }
    }
  };

  // Save current completed work collection
  const triggerCollectInVictoryScreen = () => {
    watchAd('Unlock artwork into gallery database', () => saveActiveToCollections());
  };

  // Download high-resolution in victory screen
  const triggerDownloadInVictoryScreen = () => {
    watchAd('Download crystal clear master art', () => downloadActiveMasterArt());
  };

  // ----------------------------------------------------
  // 7. Render Builders
  // ----------------------------------------------------

  // Find image level to display as background of screen on carousel
  const findHomeCarouselBackgroundOfScreen = (line: StageLine) => {
    const clearedLvl = stages[line]?.clearedLevel ?? 0;
    // 1st level is exposed always, subsequent levels are locked until cleared.
    const bgLvl = isNaN(clearedLvl) || typeof clearedLvl !== 'number' ? 1 : Math.max(1, clearedLvl);
    const prefix = getStagePrefix(line, bgLvl);
    return getStageImage(prefix, bgLvl).local;
  };

  // Render the sliding dual home-screen columns
  const renderHomeCarouselScreens = () => {
    // Array order: Ad Line, Normal Line (Default), Premium Line
    const lines: Array<{ line: StageLine; screenIdx: -1 | 1 | 2; buttonColor: string, bgColor: string }> = [
      {
        line: 'ad',
        screenIdx: -1,
        buttonColor: 'text-white font-black text-lg tracking-widest transition-all duration-300',
        // 负一屏（广告关）：进入按钮改为蓝色，角标（播放三角）保留
        bgColor: '#0ea5e9'
      },
      {
        line: 'normal',
        screenIdx: 1,
        buttonColor: 'text-white font-black text-lg tracking-widest transition-all duration-300',
        // 普通屏：沿用共享库绿（与 .xp-enter-btn 同色，保持公共库一致）
        bgColor: '#65c52c'
      },
      {
        line: 'premium',
        screenIdx: 2,
        buttonColor: 'text-white font-black text-lg tracking-widest transition-all duration-300',
        // 二屏（钻石关）：进入按钮改为紫色，角标（钻石成本）保留
        bgColor: '#a855f7'
      },
    ];

    // Determine horizontal container shift:
    // Screen -1 (Ad) -> 0%
    // Screen 1 (Normal) -> -33.333%
    // Screen 2 (Premium) -> -66.666%
    const translatePct = currentScreen === -1 ? '0%' : currentScreen === 1 ? '-33.333%' : '-66.666%';

    return (
      <div
        className="relative flex-1 w-full overflow-hidden select-none cursor-grab active:cursor-grabbing"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
      >
        {/* Swiper strip */}
        <div
          style={{ transform: `translateX(${translatePct})` }}
          className="flex flex-row w-[300vw] h-full transition-transform duration-500 ease-out"
        >
          {lines.map(({ line, screenIdx, buttonColor, bgColor }) => {
            const levelState = stages[line];
            const bgUrl = findHomeCarouselBackgroundOfScreen(line);

            // Is the Premium Screen Entry's badge diamond-insufficient?
            const premiumNextLvl = stages.premium?.level ?? 1;
            const premiumPieces = getStageTotalPieces('premium', premiumNextLvl);
            const premiumCost = Math.round(premiumPieces * 1.5 + Math.pow(premiumPieces, 1.5) * 0.4);
            const isPremiumInsufficient = wallet.diamonds < premiumCost;

            return (
              <div
                key={line}
                style={{ backgroundImage: `url(${bgUrl})` }}
                className="w-screen h-full bg-cover bg-center shrink-0 relative flex flex-col justify-between"
              >
                {/* Sub-Header spacers */}
                <div className="h-24 z-10" />

                {/* Empty spacer replacing Graphic Label */}
                <div className="flex-1" />

                  {/* Combined Bottom Area (Capsule over indicator) */}
                  <div className="w-full flex flex-col items-center z-10 pb-[80px] gap-[20px]">

                    <div className="flex justify-center items-center w-full gap-3">
                      {/* 日活 + 收藏 图标胶囊：只在首页主屏（normal）出现，对齐 story .home-pill */}
                      {line === 'normal' && (
                        <div className="xp-pill">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsDailyOpen(true);
                              playZenChime(440, 'sine', 0.1, 0.05);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            id={`header-open-daily-${line}`}
                            className="xp-icon-btn"
                          >
                            <div className={`flex items-center justify-center ${checkDailyFeaturesRedDot() ? 'heartbeat-anim' : ''}`}>
                              <img src={assetUrl('ui/icon_star.svg')} alt="activity" />
                            </div>
                          </button>

                          {/* Gallery Panel trigger icon */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsGalleryOpen(true);
                              playZenChime(440, 'sine', 0.1, 0.05);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            id={`header-open-gallery-${line}`}
                            className="xp-icon-btn"
                          >
                            <img src={assetUrl('ui/icon_like.svg')} alt="collect" />
                          </button>
                        </div>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleHomePlayClick(line);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        id={`play-gate-${line}`}
                        className="xp-enter-btn relative"
                        style={{ background: bgColor, margin: 0 }}
                      >
                        {/* White text containing the upcoming stage levels */}
                        <span className="font-mono text-xl font-black tracking-widest text-white relative z-10">
                          {String(levelState?.level ?? 1).padStart(4, '0')}
                        </span>

                        {/* Specialized Badges */}
                        {line === 'ad' && (
                          <div className="absolute -top-2 -right-2 bg-white px-2 h-5.5 rounded-full flex items-center justify-center pointer-events-none z-10">
                            <Play className="w-3.5 h-3.5 fill-black text-black" strokeWidth={3} style={{ strokeLinejoin: 'round', strokeLinecap: 'round' }} />
                          </div>
                        )}

                        {line === 'premium' && (
                          <div
                            className={`absolute -top-2 -right-2 bg-white text-[9px] font-black px-2 h-5.5 rounded-full flex items-center border pointer-events-none z-10 ${
                              isPremiumInsufficient ? 'text-rose-600 border-rose-200' : 'text-black border-neutral-100'
                            }`}
                          >
                            <XpIcon name="diamond" className="w-3 h-3" />
                            <span className="ml-[1px]">-{premiumCost}</span>
                          </div>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
            );
          })}
        </div>

        {/* Minimal edges slide chevrons for Desktop accessibility */}
        {currentScreen !== -1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCurrentScreen((p) => (p === 2 ? 1 : -1));
              playZenChime(330, 'sine', 0.1, 0.05);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-black/35 text-white hover:bg-black/60 transition z-20 cursor-pointer hidden md:flex"
          >
            <img src={assetUrl('ui/icon_chevron_left.svg')} alt="" className="w-6 h-6" />
          </button>
        )}

        {currentScreen !== 2 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCurrentScreen((p) => (p === -1 ? 1 : 2));
              playZenChime(330, 'sine', 0.1, 0.05);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-black/35 text-white hover:bg-black/60 transition z-20 cursor-pointer hidden md:flex"
          >
            <img src={assetUrl('ui/icon_chevron_right.svg')} alt="" className="w-6 h-6" />
          </button>
        )}
      </div>
    );
  };

  // ----------------------------------------------------
  // 8. Yield and outputs helper
  // ----------------------------------------------------
  const getVictoryRewardInfo = () => {
    if (activeChallengeDay !== null) return { amount: 2000, line: 'normal' as const };
    const activeStage = stages[activeLine] || { level: 1 };
    const lvl = activeStage.level ?? 1;
    const pieces = getStageTotalPieces(activeLine, lvl);
    let amount = 0;
    if (activeLine === 'normal') amount = pieces * 100;
    if (activeLine === 'ad') amount = pieces * 150;
    if (activeLine === 'premium') amount = pieces * 200;
    
    return { amount, line: activeLine as 'normal' | 'ad' | 'premium' };
  };

  // Determine if active level has been successfully stored in Collections
  const isActiveSolvedInGallery = () => {
    let lvl: number;
    let prefix: string;
    if (activeChallengeDay !== null) {
      lvl = activeChallengeDay;
      prefix = 'g';
    } else {
      const activeStage = stages[activeLine] || { level: 1 };
      lvl = activeStage.level ?? 1;
      prefix = getStagePrefix(activeLine, lvl);
    }
    return collections.some((c) => c.prefix === prefix && c.level === lvl);
  };

  const checkDailyFeaturesRedDot = () => {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const sign = dailyFeatures.signInData.lastDate !== today;
    const chal = !dailyFeatures.challengeData.completedDays.includes(d.getDate());
    const wheel = dailyFeatures.wheelData.freeSpins > 0 || dailyFeatures.wheelData.adSpins > 0;
    return sign || chal || wheel;
  };

  return (
    <div className="w-full h-screen bg-black text-white relative flex flex-col justify-between overflow-hidden font-sans">
      
      <GuideOverlay isOpen={isGuideOpen} onClose={() => { setIsGuideOpen(false); try { localStorage.setItem('girls_puzzle_guide_seen', 'true'); } catch(e){} }} />
      {/* Dynamic Feedback HUD absolute toaster */}
      <AnimatePresence>
        {feedbackToast && (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -40, scale: 0.95 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 border border-neutral-800 text-white py-2 px-4 rounded-full text-xs font-medium tracking-wide backdrop-blur-md flex items-center gap-1.5"
          >
            <img src={assetUrl('ui/icon_info.svg')} alt="" className="w-4 h-4" />
            <span>{feedbackToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ----------------------------------------------------
          A. MAIN VISUAL: HOME SCREEN STAGE MATRIX
          ---------------------------------------------------- */}
      {appState === 'home' && (
        <div id="home-view-canvas" className="absolute inset-0 flex flex-col justify-between">
          
          {/* Top currency capsule — 共享库 XP_Kit.resbar 渲染（点击开商城） */}
          <GlobalResbar
            coins={wallet.coins}
            diamonds={wallet.diamonds}
            onClick={() => {
              setIsShopOpen(true);
              playZenChime(440, 'sine', 0.1, 0.05);
            }}
          />

          {/* Swipe columns */}
          {renderHomeCarouselScreens()}

          {/* Core Indicator & Indicators tray strictly at the very bottom */}
          <div className="absolute bottom-[30px] left-0 right-0 z-30 flex flex-col items-center justify-center pointer-events-none gap-2">
            {/* Dots using Vibrant Palette exact colors and shadow highlights */}
            <div id="dot-indicator-tray" className="flex justify-center items-center gap-3 pointer-events-auto h-6">
              <button
                onClick={() => {
                  setCurrentScreen(-1);
                  playZenChime(300, 'sine', 0.1, 0.05);
                }}
                className={`transition-all duration-300 rounded-full h-2 cursor-pointer ${
                  currentScreen === -1 ? 'w-6' : 'w-2 opacity-40 hover:opacity-80'
                }`}
                style={{ backgroundColor: currentScreen === -1 ? 'var(--xp-magenta)' : 'rgba(255,255,255,0.3)' }}
              />
              <button
                onClick={() => {
                  setCurrentScreen(1);
                  playZenChime(300, 'sine', 0.1, 0.05);
                }}
                className={`transition-all duration-300 rounded-full h-2 cursor-pointer ${
                  currentScreen === 1 ? 'w-6' : 'w-2 opacity-40 hover:opacity-80'
                }`}
                style={{ backgroundColor: currentScreen === 1 ? 'var(--xp-green)' : 'rgba(255,255,255,0.3)' }}
              />
              <button
                onClick={() => {
                  setCurrentScreen(2);
                  playZenChime(300, 'sine', 0.1, 0.05);
                }}
                className={`transition-all duration-300 rounded-full h-2 cursor-pointer ${
                  currentScreen === 2 ? 'w-6' : 'w-2 opacity-40 hover:opacity-80'
                }`}
                style={{ backgroundColor: currentScreen === 2 ? 'var(--xp-gold)' : 'rgba(255,255,255,0.3)' }}
              />
            </div>
            
            <div className="xp-home__brand !pointer-events-auto flex items-center justify-center gap-2 opacity-30 hover:opacity-100 transition-opacity">
              <span onClick={() => setIsGuideOpen(true)} className="cursor-pointer hover:underline">girls puzzle</span>
              <span>|</span>
              <span onClick={() => { (window.top ?? window).location.href = '/'; }} className="cursor-pointer hover:underline">xplaymini.win</span>
            </div>
          </div>

        </div>
      )}

      {/* ----------------------------------------------------
          B. ACTIVE GAME BOARD SCREENS
          ---------------------------------------------------- */}
      {appState === 'play' && (
        <PuzzleBoard
          prefix={activeChallengeDay !== null ? 'g' : getStagePrefix(activeLine, stages[activeLine].level)}
          level={activeChallengeDay !== null ? activeChallengeDay : stages[activeLine].level}
          wallet={wallet}
          setWallet={setWallet}
          settings={settings}
          setSettings={setSettings}
          onGiveUp={() => {
            setAppState('home');
            setActiveChallengeDay(null);
            playZenChime(220, 'sine', 0.3, 0.05);
          }}
          onVictory={handlePuzzleBoardVictory}
          triggerAdForSteps={handleReviveStepsAdRequest}
          shouldAddStepsToken={shouldAddSteps}
          clearAddStepsToken={() => setShouldAddSteps(false)}
        />
      )}

      {/* ----------------------------------------------------
          C. CELEBRATORY VICTORY SCREENS
          ---------------------------------------------------- */}
      {/* Flying Resources Overlay */}
      

      {appState === 'win' && (
        <VictoryOverlay
          prefix={activeChallengeDay !== null ? 'g' : getStagePrefix(activeLine, stages[activeLine].level)}
          level={activeChallengeDay !== null ? activeChallengeDay : stages[activeLine].level}
          onHome={() => {
            if (activeChallengeDay !== null) {
              setAppState('home');
              setActiveChallengeDay(null);
              setIsDailyOpen(true);
              return;
            }
            // Advanced level state
            const target = stages[activeLine];
            setStages((prev) => ({
              ...prev,
              [activeLine]: {
                level: target.level + 1,
                clearedLevel: Math.max(target.clearedLevel, target.level),
              },
            }));
            setAppState('home');
            playZenChime(330, 'sine', 0.2, 0.05);
          }}
          onNext={activeChallengeDay !== null ? undefined : handleAdvanceToNextStage}
          onUnlockCollection={triggerCollectInVictoryScreen}
          onDownloadImage={triggerDownloadInVictoryScreen}
          isUnlockedInCollection={isActiveSolvedInGallery()}
          rewardInfo={getVictoryRewardInfo()}
          onDoubleRewards={() => {
            watchAd('Get 2x victory rewards!', () => doubleVictoryPayout());
          }}
          doubleClaimed={doubleClaimed}
          wallet={wallet}
        />
      )}

      {/* ----------------------------------------------------
          D. THE SHOP / GENERAL EXCHANGE STORE
          ---------------------------------------------------- */}
      <ShopPanel
        isOpen={isShopOpen}
        onClose={() => setIsShopOpen(false)}
        wallet={wallet}
        setWallet={setWallet}
      />

      {/* ----------------------------------------------------
          E. THE ARCHIVED NOSTALGIA DEED GALLERY
          ---------------------------------------------------- */}
      <CollectionPanel
        isOpen={isGalleryOpen}
        onClose={() => setIsGalleryOpen(false)}
        collections={collections}
        onDeleteCollection={handleDeleteCollectionItem}
        settings={settings}
        setSettings={setSettings}
        wallet={wallet}
        setWallet={setWallet}
        showToast={triggerToast}
      />

      {/* ----------------------------------------------------
          G. DAILY FEATURES & EVENTS PANEL
          ---------------------------------------------------- */}
      <DailyFeaturesPanel
        isOpen={isDailyOpen}
        onClose={() => setIsDailyOpen(false)}
        wallet={wallet}
        setWallet={setWallet}
        triggerToast={triggerToast}
        onLaunchChallenge={onLaunchChallenge}
        state={dailyFeatures}
        setState={setDailyFeatures}
        triggerAdForFeature={triggerAdForFeature}
      />

    </div>
  );
}
