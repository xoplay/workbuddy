import React, { useState, useEffect } from 'react';

export function RollingValue({ value, initialDelta = 0, isFloat = false }: { value: number, initialDelta?: number, isFloat?: boolean }) {
  const [displayValue, setDisplayValue] = useState(value - initialDelta);
  
  useEffect(() => {
    if (displayValue === value) return;

    let startTimestamp: number | null = null;
    const startValue = displayValue;
    const distance = value - startValue;
    // 每增加1000，动画时长加1秒，动画过程最少1秒
    const duration = Math.max(1000, Math.abs(distance));

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const t = Math.min(elapsed / duration, 1);
      
      // 滚动初始加速度，滚动到后面减速度 (easeInOutQuad)
      const progress = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      
      setDisplayValue(startValue + distance * progress);
      
      if (t < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplayValue(value);
      }
    };
    
    const token = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(token);
  }, [value]);

  return <span>{isFloat ? displayValue.toFixed(1).replace(/\.0$/, '') : Math.floor(displayValue)}</span>;
}
