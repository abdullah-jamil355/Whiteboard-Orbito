"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";

export type AnimatedCounterProps = Readonly<{
  decimals?: number;
  duration?: number;
  value: number;
}>;

export const AnimatedCounter = ({
  value,
  decimals = 0,
  duration = 1400
}: AnimatedCounterProps): ReactElement => {
  const [displayValue, setDisplayValue] = useState(0);
  const startValueRef = useRef(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = startValueRef.current;
    const diff = value - startValue;

    if (diff === 0) return;

    let animationFrameId: number;

    const step = (timestamp: number): void => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo easing function
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = startValue + diff * ease;

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        startValueRef.current = value;
        setDisplayValue(value);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return (): void => {
      cancelAnimationFrame(animationFrameId);
      startValueRef.current = value;
    };
  }, [value, duration]);

  return (
    <>
      {decimals > 0
        ? displayValue.toFixed(decimals)
        : Math.round(displayValue).toLocaleString()}
    </>
  );
};
