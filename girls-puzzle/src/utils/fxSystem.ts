export type FXEvent = {
  sourceId: string | null;
  targetIcon: 'coin' | 'diamond' | 'ticket' | 'pearl' | 'video' | 'album';
  amount: number;
  onFinish?: () => void;
};
export const fxSystem = {
  listeners: [] as ((event: FXEvent) => void)[],
  spawn: (event: FXEvent) => {
    fxSystem.listeners.forEach(l => l(event));
  },
  subscribe: (listener: (event: FXEvent) => void) => {
    fxSystem.listeners.push(listener);
    return () => {
      fxSystem.listeners = fxSystem.listeners.filter(l => l !== listener);
    };
  }
};
