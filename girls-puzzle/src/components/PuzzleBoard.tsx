/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { assetUrl } from '@/config/assets';
import { UserWallet, PuzzlePiece, GameSettings } from '../types';
import { getStageImage } from '../utils/imageRegistry';
import { ResourceIcon } from './ResourceIcon';
import {
  playClickSound,
  playSwapSound,
  playVictoryChords,
  playFailureChord,
  triggerVibration,
  playZenChime,
} from '../utils/audioSystem';

interface PuzzleBoardProps {
  prefix: string;
  level: number;
  wallet: UserWallet;
  setWallet: React.Dispatch<React.SetStateAction<UserWallet>>;
  settings: GameSettings;
  setSettings: React.Dispatch<React.SetStateAction<GameSettings>>;
  onGiveUp: () => void;
  onVictory: (doubleClaimed: boolean) => void;
  triggerAdForSteps: () => void;
  shouldAddStepsToken: boolean;
  clearAddStepsToken: () => void;
}

export default function PuzzleBoard({
  prefix,
  level,
  wallet,
  setWallet,
  settings,
  setSettings,
  onGiveUp,
  onVictory,
  triggerAdForSteps,
  shouldAddStepsToken,
  clearAddStepsToken,
}: PuzzleBoardProps) {
  // Grid size calculation
  const getGridDims = (lvl: number) => {
    if (prefix === 'g') {
      if (lvl <= 10) return { rows: 6, cols: 6 };
      if (lvl <= 20) return { rows: 7, cols: 7 };
      return { rows: 8, cols: 8 };
    }

    let baseSize = 3 + Math.floor((lvl - 1) / 25);
    baseSize = Math.min(baseSize, 6);
    
    let floatSize = 0;
    if (lvl % 25 === 0) {
      floatSize = 2;
    } else if (lvl % 5 === 0) {
      floatSize = 1;
    }
    
    const size = Math.min(baseSize + floatSize, 8);
    return { rows: size, cols: size };
  };

  const { rows, cols } = getGridDims(level);
  const totalPieces = rows * cols;

  // Image assets
  const imgData = getStageImage(prefix, level);
  const [activeImage, setActiveImage] = useState(imgData.local); // default to local

  // Puzzle configuration & pieces state
  const [pieces, setPieces] = useState<PuzzlePiece[]>([]);
  const [stepsLeft, setStepsLeft] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isWon, setIsWon] = useState(false);
  const [isFailed, setIsFailed] = useState(false);

  // Settings Menu fold status
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (isWon) {
      const timer = setTimeout(() => {
        onVictory(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWon]);

  // Container refs & reactive states for real-time visual drag-and-drop
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; slotIdx: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredSlotIdx, setHoveredSlotIdx] = useState<number | null>(null);

  // Handle image loading fallback
  const handleImageError = () => {
    if (activeImage !== imgData.fallback) {
      setActiveImage(imgData.fallback);
    }
  };

  // 1. Initialize stage
  useEffect(() => {
    // S = ceil((totalPieces / 2) * 1.3)
    const initialSteps = Math.ceil((totalPieces / 2) * 1.3);
    setStepsLeft(initialSteps);
    setIsWon(false);
    setIsFailed(false);
    setSelectedIdx(null);
    setSettingsOpen(false);
    setActiveImage(getStageImage(prefix, level).local);

    // Scramble: Ensure pieces are sufficiently shuffled
    const initPieces: PuzzlePiece[] = [];
    const positions = Array.from({ length: totalPieces }, (_, i) => i);
    
    // Simple Fisher-Yates shuffle that doesn't start in a pre-solved state
    let scrambled = [...positions];
    let scrambleMatchDegree = totalPieces;
    let limit = 0;

    while (scrambleMatchDegree > Math.floor(totalPieces * 0.3) && limit < 20) {
      for (let i = scrambled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = scrambled[i];
        scrambled[i] = scrambled[j];
        scrambled[j] = temp;
      }
      scrambleMatchDegree = scrambled.filter((v, i) => v === i).length;
      limit++;
    }

    scrambled.forEach((val, index) => {
      initPieces.push({
        correctIdx: val, // which chunk belongs here
        currentIdx: index, // visual location in original order
      });
    });

    setPieces(initPieces);
  }, [prefix, level, totalPieces]);

  // Listen to step-revival notifications from simulated ads
  useEffect(() => {
    if (shouldAddStepsToken) {
      setStepsLeft((prev) => prev + 3);
      setIsFailed(false);
      clearAddStepsToken();
    }
  }, [shouldAddStepsToken]);

  // Count remaining tiles which are misplaced (unsorted)
  const unsortedCount = pieces.filter((p, i) => p.correctIdx !== i).length;
  // Cost factor: 10 diamonds per unsorted tile
  const passCost = unsortedCount * 10;

  // Find relative connections on layout grid
  const areSlotsRelatives = (u: number, v: number): boolean => {
    const rU = Math.floor(u / cols);
    const cU = u % cols;
    const rV = Math.floor(v / cols);
    const cV = v % cols;

    // Must be adjacent (up, down, left, right) in visual slots
    if (Math.abs(rU - rV) + Math.abs(cU - cV) !== 1) return false;

    const pieceU = pieces[u];
    const pieceV = pieces[v];
    if (!pieceU || !pieceV) return false;

    const correctRU = Math.floor(pieceU.correctIdx / cols);
    const correctCU = pieceU.correctIdx % cols;
    
    const correctRV = Math.floor(pieceV.correctIdx / cols);
    const correctCV = pieceV.correctIdx % cols;

    // Relative offsets in visual grid must match correct source slice layout
    return (correctRU - correctRV === rU - rV) && (correctCU - correctCV === cU - cV);
  };

  const findGroupOf = (startSlot: number): number[] => {
    if (startSlot < 0 || startSlot >= totalPieces) return [];
    const visited = new Set<number>();
    const queue = [startSlot];
    visited.add(startSlot);

    let head = 0;
    while (head < queue.length) {
      const curr = queue[head++];
      const r = Math.floor(curr / cols);
      const c = curr % cols;

      // Check adjacent neighbors (up, down, left, right)
      const neighbors = [];
      if (r > 0) neighbors.push(curr - cols);
      if (r < rows - 1) neighbors.push(curr + cols);
      if (c > 0) neighbors.push(curr - 1);
      if (c < cols - 1) neighbors.push(curr + 1);

      for (const n of neighbors) {
        if (!visited.has(n)) {
          if (areSlotsRelatives(curr, n)) {
            visited.add(n);
            queue.push(n);
          }
        }
      }
    }

    return queue;
  };

  // Group connection memoization mapped by visual slot indexes
  const groupsMemo = React.useMemo(() => {
    const groups: Record<number, number[]> = {};
    const visited = new Set<number>();
    for (let i = 0; i < totalPieces; i++) {
      if (!visited.has(i)) {
        const g = findGroupOf(i);
        g.forEach((slot) => {
          visited.add(slot);
          groups[slot] = g;
        });
      }
    }
    return groups;
  }, [pieces, totalPieces, cols, rows]);

  // Handle core single-tile transposition / swap
  const swapPieces = (idxA: number, idxB: number) => {
    if (isWon || isFailed) return;
    if (idxA < 0 || idxA >= totalPieces || idxB < 0 || idxB >= totalPieces) return;

    playSwapSound(settings.soundEnabled);
    triggerVibration(settings.vibrationEnabled, 50);

    const nextPieces = [...pieces];
    const temp = nextPieces[idxA];
    nextPieces[idxA] = nextPieces[idxB];
    nextPieces[idxB] = temp;

    setPieces(nextPieces);
    setSelectedIdx(null);

    // Verify win criteria
    const solved = nextPieces.every((p, i) => p.correctIdx === i);
    if (solved) {
      setIsWon(true);
      playVictoryChords(settings.soundEnabled);
      return;
    }

    // Spend step
    const nextSteps = stepsLeft - 1;
    setStepsLeft(nextSteps);

    if (nextSteps <= 0) {
      setIsFailed(true);
      playFailureChord(settings.soundEnabled);
    }
  };

  // Swap entire connected group based on drag offset (or single piece fallback)
  const swapGroupAndPieces = (startIdx: number, endIdx: number) => {
    if (isWon || isFailed) return;
    if (startIdx < 0 || startIdx >= totalPieces || endIdx < 0 || endIdx >= totalPieces) return;

    const startR = Math.floor(startIdx / cols);
    const startC = startIdx % cols;
    const endR = Math.floor(endIdx / cols);
    const endC = endIdx % cols;

    const deltaR = endR - startR;
    const deltaC = endC - startC;

    if (deltaR === 0 && deltaC === 0) return;

    // Find the current connected relative group
    const group = findGroupOf(startIdx);

    // Verify if translation offset is globally safe across grid bounds
    let isMoveValid = true;
    const targets: number[] = [];
    for (const slot of group) {
      const targetR = Math.floor(slot / cols) + deltaR;
      const targetC = (slot % cols) + deltaC;
      if (targetR < 0 || targetR >= rows || targetC < 0 || targetC >= cols) {
        isMoveValid = false;
        break;
      }
      targets.push(targetR * cols + targetC);
    }

    playSwapSound(settings.soundEnabled);
    triggerVibration(settings.vibrationEnabled, 50);

    const nextPieces = [...pieces];

    if (isMoveValid) {
      // Shifting entire group - swap any displaced elements back to vacated cells
      const vacated = group.filter((s) => !targets.includes(s));
      const displaced = targets.filter((t) => !group.includes(t));

      const tempPositions: Record<number, PuzzlePiece> = {};

      group.forEach((slot, index) => {
        const t = targets[index];
        tempPositions[t] = pieces[slot];
      });

      displaced.forEach((t, i) => {
        const v = vacated[i];
        tempPositions[v] = pieces[t];
      });

      Object.entries(tempPositions).forEach(([slotStr, piece]) => {
        const slotIdx = parseInt(slotStr, 10);
        nextPieces[slotIdx] = piece;
      });
    } else {
      // Degrade gracefully into a simple single-tile swap if group borders are hit
      const temp = nextPieces[startIdx];
      nextPieces[startIdx] = nextPieces[endIdx];
      nextPieces[endIdx] = temp;
    }

    setPieces(nextPieces);
    setSelectedIdx(null);

    // Check complete sorted state
    const solved = nextPieces.every((p, i) => p.correctIdx === i);
    if (solved) {
      setIsWon(true);
      playVictoryChords(settings.soundEnabled);
      return;
    }

    // Spend step
    const nextSteps = stepsLeft - 1;
    setStepsLeft(nextSteps);

    if (nextSteps <= 0) {
      setIsFailed(true);
      playFailureChord(settings.soundEnabled);
    }
  };

  // Real-time Coordinate Drag-and-Drop Interaction Events
  const startDrag = (clientX: number, clientY: number) => {
    if (isWon || isFailed || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const relativeY = clientY - rect.top;

    const col = Math.floor((relativeX / rect.width) * cols);
    const row = Math.floor((relativeY / rect.height) * rows);
    const startIdx = row * cols + col;

    if (startIdx >= 0 && startIdx < totalPieces) {
      setDragStart({ x: clientX, y: clientY, slotIdx: startIdx });
      setDragOffset({ x: 0, y: 0 });
      setHoveredSlotIdx(startIdx);
    }
  };

  const handleOverlayMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Left click only
    startDrag(e.clientX, e.clientY);
  };

  const handleOverlayTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 0) return;
    startDrag(e.touches[0].clientX, e.touches[0].clientY);
  };

  const moveDrag = (clientX: number, clientY: number) => {
    if (!dragStart || !boardRef.current) return;
    
    // Calculate raw offset
    const dx = clientX - dragStart.x;
    const dy = clientY - dragStart.y;
    setDragOffset({ x: dx, y: dy });

    // Find current hovered slot index
    const rect = boardRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const relativeY = clientY - rect.top;

    const col = Math.floor((relativeX / rect.width) * cols);
    const row = Math.floor((relativeY / rect.height) * rows);

    if (col >= 0 && col < cols && row >= 0 && row < rows) {
      const hoverIdx = row * cols + col;
      setHoveredSlotIdx(hoverIdx);
    } else {
      setHoveredSlotIdx(null);
    }
  };

  const handleOverlayMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    moveDrag(e.clientX, e.clientY);
  };

  const handleOverlayTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 0) return;
    moveDrag(e.touches[0].clientX, e.touches[0].clientY);
  };

  const releaseDrag = (clientX: number, clientY: number) => {
    if (!dragStart || !boardRef.current) return;

    const startIdx = dragStart.slotIdx;
    
    const rect = boardRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const relativeY = clientY - rect.top;

    const col = Math.floor((relativeX / rect.width) * cols);
    const row = Math.floor((relativeY / rect.height) * rows);

    let endIdx: number | null = null;
    if (col >= 0 && col < cols && row >= 0 && row < rows) {
      endIdx = row * cols + col;
    }

    const dragDistance = Math.hypot(clientX - dragStart.x, clientY - dragStart.y);

    if (dragDistance > 15 && endIdx !== null && endIdx !== startIdx) {
      // Drag & Drop detected! Perform group or pieces swap
      swapGroupAndPieces(startIdx, endIdx);
    } else {
      // Direct click gesture
      playClickSound(settings.soundEnabled);
      triggerVibration(settings.vibrationEnabled, 30);

      if (selectedIdx === null) {
        setSelectedIdx(startIdx);
      } else {
        if (selectedIdx === startIdx) {
          setSelectedIdx(null);
        } else {
          swapPieces(selectedIdx, startIdx);
        }
      }
    }

    // Reset drag state
    setDragStart(null);
    setDragOffset({ x: 0, y: 0 });
    setHoveredSlotIdx(null);
  };

  const handleOverlayMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    releaseDrag(e.clientX, e.clientY);
  };

  const handleOverlayTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.changedTouches.length === 0) return;
    releaseDrag(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
  };

  // Close Settings panel when clicking away
  const handleAwayDismiss = () => {
    if (settingsOpen) {
      setSettingsOpen(false);
      playClickSound(settings.soundEnabled);
    }
  };

  // One-Click Bypass (一键通关)
  const executeInstantPass = () => {
    if (wallet.diamonds >= passCost) {
      setWallet((prev) => ({ ...prev, diamonds: prev.diamonds - passCost }));
      playZenChime(587.33, 'sine', 1.0, 0.15); // Re chime major
      
      // Immediately sort all pieces
      const fullySolved = Array.from({ length: totalPieces }, (_, i) => ({
        correctIdx: i,
        currentIdx: i,
      }));
      setPieces(fullySolved);
      setIsWon(true);
      playVictoryChords(settings.soundEnabled);
    } else {
      // Sound fail buzz
      playZenChime(150, 'sawtooth', 0.25, 0.05);
      triggerVibration(settings.vibrationEnabled, 100);
    }
  };

  return (
    <div
      onClick={handleAwayDismiss}
      id="puzzle-board-screen"
      style={{ backgroundImage: `url(${activeImage})` }}
      className="fixed inset-0 z-20 flex items-center justify-center bg-[#0a0a0a] bg-cover bg-center select-none overflow-hidden"
    >
      {/* Dynamic Image Fallback loader */}
      <img src={activeImage} className="hidden" onError={handleImageError} alt="tracker" referrerPolicy="no-referrer" />

      {/* Background image layer to provide depth for desktop/tablet screens, no filter */}
      <img src={activeImage} className="absolute inset-0 w-full h-full object-cover z-0" alt="background" referrerPolicy="no-referrer" />

      {/* Core 9:16 Full Screen Arena, matching height proportionally and centering on widescreen */}
      <div
        ref={boardRef}
        id="puzzle-active-grid"
        className="relative w-full h-full bg-black overflow-hidden z-10"
      >
        {/* Core Jigsaw Grid Tiles (Z-INDEX: 0) */}
        {pieces.map((piece, visualSlot) => {
          const currentR = Math.floor(visualSlot / cols);
          const currentC = visualSlot % cols;

          const correctR = Math.floor(piece.correctIdx / cols);
          const correctC = piece.correctIdx % cols;

          const wPct = 100 / cols;
          const hPct = 100 / rows;

          // Drag and drop highlights and transitions
          const isActivelyDraggedGroup = dragStart !== null && groupsMemo[dragStart.slotIdx]?.includes(visualSlot);

          let transformStyle = '';
          let dragZIndex = 10;
          let dragTransition = 'all 0.35s cubic-bezier(0.23, 1, 0.32, 1)';

          if (isActivelyDraggedGroup) {
            transformStyle = `translate3d(${dragOffset.x}px, ${dragOffset.y}px, 0)`;
            dragZIndex = 50;
            dragTransition = 'none'; // Instant drag tracking
          }

          return (
            <div
              key={piece.correctIdx}
              style={{
                width: `${wPct}%`,
                height: `${hPct}%`,
                left: `${currentC * wPct}%`,
                top: `${currentR * hPct}%`,
                transform: transformStyle,
                zIndex: dragZIndex,
                transition: dragTransition,
              }}
              className="absolute overflow-hidden select-none pointer-events-none bg-black"
            >
              <img
                src={activeImage}
                style={{
                  position: 'absolute',
                  width: `${cols * 100}%`,
                  height: `${rows * 100}%`,
                  left: `-${correctC * 100}%`,
                  top: `-${correctR * 100}%`,
                  objectFit: 'cover'
                }}
                className="max-w-none pointer-events-none"
                alt=""
                referrerPolicy="no-referrer"
              />
              {/* Optional: border removed to avoid cutting seamless image */}
              {!isWon && (
                <div 
                  className="absolute inset-0 pointer-events-none box-border" 
                  style={{
                    borderRight: (currentC < cols - 1 && !groupsMemo[visualSlot].includes(visualSlot + 1)) ? '1px solid black' : undefined,
                    borderBottom: (currentR < rows - 1 && !groupsMemo[visualSlot].includes(visualSlot + cols)) ? '1px solid black' : undefined,
                    borderLeft: (currentC > 0 && !groupsMemo[visualSlot].includes(visualSlot - 1)) ? '1px solid black' : undefined,
                    borderTop: (currentR > 0 && !groupsMemo[visualSlot].includes(visualSlot - cols)) ? '1px solid black' : undefined,
                  }}
                />
              )}
            </div>
          );
        })}

        {/* Transparent Drag Cover overlay (Z-INDEX: 20) */}
        <div
          id="puzzle-anti-theft-shield"
          onMouseDown={handleOverlayMouseDown}
          onMouseMove={handleOverlayMouseMove}
          onMouseUp={handleOverlayMouseUp}
          onTouchStart={handleOverlayTouchStart}
          onTouchMove={handleOverlayTouchMove}
          onTouchEnd={handleOverlayTouchEnd}
          onClick={() => settingsOpen && setSettingsOpen(false)}
          className="absolute inset-0 z-20 w-full h-full bg-transparent select-none cursor-grab active:cursor-grabbing touch-none"
        />

        {/* Single Bottom HUD Widget & Expanding Menu (Z-INDEX: 30) */}
        <div className="absolute bottom-6 left-6 z-30 flex items-center gap-2">
          {/* Main Toggle Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSettingsOpen(!settingsOpen);
              playClickSound(settings.soundEnabled);
            }}
            id="settings-trigger-btn"
            className={`w-12 h-12 flex items-center justify-center rounded-full text-white shadow-none transition-colors duration-300 cursor-pointer relative top-0 left-0 ${settingsOpen ? 'bg-black/90' : 'bg-black/50'}`}
          >
            <img src="/ui/icon_lightning.svg" alt="" className="w-6 h-6" />
            <div className={`absolute -top-1 -right-1 text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none bg-white border-transparent ${
              stepsLeft === 3 ? 'text-orange-500' :
              stepsLeft === 2 ? 'text-red-500' :
              stepsLeft === 1 ? 'text-rose-600' :
              'text-black'
            }`}>
              {stepsLeft}
            </div>
          </button>

          {/* Expanded Menu Strip */}
          <AnimatePresence>
            {settingsOpen && (
              <motion.div
                initial={{ opacity: 0, x: -10, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -10, scale: 0.95 }}
                transition={{ type: 'spring', damping: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-2 bg-black/90 px-2 py-1 rounded-full pointer-events-auto transition-colors duration-300"
              >
                <button
                  onClick={onGiveUp}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 text-white transition cursor-pointer"
                >
                  <img src="/ui/icon_home.svg" alt="" className="w-5 h-5" />
                </button>

                <button
                  onClick={() => setSettings((p) => ({ ...p, soundEnabled: !p.soundEnabled }))}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition cursor-pointer"
                >
                  <img src="/ui/icon_sound.svg" alt="" className={`w-5 h-5 transition-opacity ${settings.soundEnabled ? 'opacity-100' : 'opacity-20'}`} />
                </button>

                <button
                  onClick={() => setSettings((p) => ({ ...p, musicEnabled: !p.musicEnabled }))}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition cursor-pointer"
                >
                  <img src="/ui/icon_music.svg" alt="" className={`w-5 h-5 transition-opacity ${settings.musicEnabled ? 'opacity-100' : 'opacity-20'}`} />
                </button>

                <button
                  onClick={() => setSettings((p) => ({ ...p, vibrationEnabled: !p.vibrationEnabled }))}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition cursor-pointer"
                >
                  <img src="/ui/icon_shake.svg" alt="" className={`w-5 h-5 transition-opacity ${settings.vibrationEnabled ? 'opacity-100' : 'opacity-20'}`} />
                </button>

                <div className="w-[1px] h-6 bg-white/20 shrink-0 mx-1" />

                {/* Instant Pass */}
                <button
                  onClick={executeInstantPass}
                  id="help-auto-finish"
                  className={`relative flex items-center justify-center w-8 h-8 transition cursor-pointer overflow-visible ${
                    wallet.diamonds >= passCost
                      ? 'hover:scale-110'
                      : 'cursor-not-allowed opacity-50'
                  }`}
                >
                  <span className={`font-mono text-[28px] font-black leading-none mt-0.5 ${
                    wallet.diamonds >= passCost 
                      ? 'text-[#65c52c] animate-pulse drop-shadow-[0_0_8px_rgba(101,197,44,0.8)]' 
                      : 'text-neutral-500'
                  }`}>&gt;</span>
                  <div className="absolute -top-1.5 -right-3 flex items-center gap-[2px] bg-white rounded-full px-1.5 py-0.5 leading-none z-10 border-transparent">
                    <ResourceIcon type="diamond" className={`w-2 h-2 ${wallet.diamonds < passCost ? 'grayscale opacity-60' : ''}`} />
                    <span className={`text-[10px] font-black leading-none ${wallet.diamonds < passCost ? 'text-rose-600' : 'text-black'}`}>{passCost}</span>
                  </div>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Failed Modal popup styled within 9:16 boundaries (Z-INDEX: 40) */}
        <AnimatePresence>
          {isFailed && (
            <div className="absolute inset-0 z-40 bg-black/85 flex items-center justify-center px-4 backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 w-full max-w-[280px] text-center relative"
              >
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
                  <img src="/ui/icon_lightning.svg" alt="" className="w-5 h-5" />
                </div>

                <h3 className="text-xs uppercase tracking-widest text-neutral-400 font-semibold mb-2">energy spent</h3>
                <p className="text-[10px] text-neutral-500 mb-6 px-1 leading-relaxed">Your steps have dissolved into the void. Recover to continue this zen state.</p>

                <div className="flex flex-col gap-2.5">
                  <button
                    onClick={triggerAdForSteps}
                    id="revive-ad-btn"
                    className="w-full py-2.5 bg-pink-600 hover:bg-pink-500 text-white rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition"
                  >
                    <img src={assetUrl('ui/icon_ads.svg')} className="w-4 h-4 object-contain" alt="video" />
                    <span>Revive (+3 steps)</span>
                  </button>

                  <button
                    onClick={onGiveUp}
                    id="quit-fail-btn"
                    className="w-full py-2.5 bg-neutral-800 text-neutral-400 hover:text-white rounded-full text-[10px] font-bold uppercase tracking-wider cursor-pointer border border-neutral-800"
                  >
                    Withdraw
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Victory Screen Backdrop overlay (Z-INDEX: 40) */}
        <AnimatePresence>
          {isWon && (
            <div className="absolute inset-0 z-40 bg-black/25 pointer-events-none transition-opacity duration-500" />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
