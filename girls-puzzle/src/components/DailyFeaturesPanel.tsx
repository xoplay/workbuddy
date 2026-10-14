import React, { useEffect, useRef } from "react";
import { UserWallet } from "../types";
import { getStageImage } from "../utils/imageRegistry";

export interface DailyFeaturesState {
  signInData: { lastDate: string; consecutiveDays: number };
  challengeData: {
    monthYear: string;
    completedDays: number[];
    adResigns: number;
    diamondResigns: number;
  };
  wheelData: { lastDate: string; freeSpins: number; adSpins: number };
}

interface DailyFeaturesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  wallet: UserWallet;
  setWallet: React.Dispatch<React.SetStateAction<UserWallet>>;
  triggerToast: (msg: string) => void;
  onLaunchChallenge: (day: number) => void;
  state: DailyFeaturesState;
  setState: React.Dispatch<React.SetStateAction<DailyFeaturesState>>;
  triggerAdForFeature: (callback: () => void) => void;
}

// 挂载共享库 XP_Kit.activity（签到+转盘+挑战三合一，单一事实来源，meow 同款薄壳）。
// 不在 girls 复制活动页结构/样式；游戏逻辑通过 resources / challenge / requestAd / onStateChange 钩子注入。
export default function DailyFeaturesPanel({
  isOpen,
  onClose,
  wallet,
  setWallet,
  onLaunchChallenge,
  setState,
  triggerAdForFeature,
}: DailyFeaturesPanelProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const walletRef = useRef(wallet);
  walletRef.current = wallet;

  useEffect(() => {
    if (!isOpen) return;
    const root = hostRef.current;
    const kit = (window as any).XP_Kit;
    if (!root || !kit || !kit.activity) return;

    const resources = {
      getCoins: () => walletRef.current.coins,
      getDiamonds: () => walletRef.current.diamonds,
      addCoins: (n: number) => setWallet((w) => ({ ...w, coins: w.coins + n })),
      addDiamonds: (n: number) => setWallet((w) => ({ ...w, diamonds: w.diamonds + n })),
      subscribe: () => () => {},
    };

    kit.activity(root, {
      gameId: "girls",
      resources,
      challenge: {
        loadImage: (day: number) => getStageImage("g", day).local,
        onOpen: (day: number) => {
          onLaunchChallenge(day);
          onClose();
        },
      },
      requestAd: (cb: () => void) => triggerAdForFeature(cb),
      onBack: onClose,
      onStateChange: (s: any) =>
        setState((prev) => ({
          ...prev,
          signInData: s.signInData,
          wheelData: {
            lastDate: s.wheelData.date,
            freeSpins: s.wheelData.free,
            adSpins: s.wheelData.ad,
          },
          challengeData: {
            ...prev.challengeData,
            completedDays: s.challengeData.completedDays,
          },
        })),
      brand: "xplaymini.win",
    });

    return () => {
      if (root) root.innerHTML = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;
  return (
    <div
      ref={hostRef}
      className="xp-activity"
      style={{ position: "fixed", inset: 0, zIndex: 60 }}
    />
  );
}
