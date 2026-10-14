import React, { useEffect, useState } from 'react';

export function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (value === displayValue) return;

    let start = displayValue;
    const end = value;
    const duration = 800; // ms
    const startTime = performance.now();

    const animateParams = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // easeOutExpo
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      
      const currentVal = start + (end - start) * easeProgress;
      
      // Keep precision heuristics
      if (Number.isInteger(end)) {
        setDisplayValue(Math.round(currentVal));
      } else {
        setDisplayValue(Number(currentVal.toFixed(1)));
      }

      if (progress < 1) {
        requestAnimationFrame(animateParams);
      } else {
        setDisplayValue(end);
      }
    };

    requestAnimationFrame(animateParams);
  }, [value]);

  return <span>{displayValue}</span>;
}
