/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type StageLine = 'normal' | 'ad' | 'premium';

export interface StageState {
  currentLevel: number;
  highestClearedLevel: number;
}

export interface UserWallet {
  coins: number;
  diamonds: number;
}

export interface PuzzlePiece {
  correctIdx: number; // The correct position index (0 to gridRows * gridCols - 1)
  currentIdx: number; // The current position index in the display grid
}

export interface CollectionItem {
  id: string; // prefix_level
  prefix: string;
  level: number;
  collectedAt: number; // timestamp
}

export interface GameSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  vibrationEnabled: boolean;
  collectionCapacity?: number;
}
