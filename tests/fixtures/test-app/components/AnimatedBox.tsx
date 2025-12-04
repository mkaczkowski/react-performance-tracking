import type { CSSProperties } from 'react';
import { useEffect, useRef } from 'react';

interface AnimatedBoxProps {
  speed?: number;
  maxDistance?: number;
  style?: CSSProperties;
}

/**
 * Animated box component that moves horizontally using requestAnimationFrame.
 * Useful for FPS tracking tests.
 */
export const AnimatedBox = ({ speed = 2, maxDistance = 300, style }: AnimatedBoxProps) => {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let x = 0;
    let rafId: number;

    const animate = () => {
      x = (x + speed) % maxDistance;
      if (boxRef.current) {
        boxRef.current.style.transform = `translateX(${x}px)`;
      }
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [speed, maxDistance]);

  return (
    <div
      ref={boxRef}
      style={{
        width: 50,
        height: 50,
        background: 'linear-gradient(45deg, #ff6b6b, #4ecdc4)',
        position: 'absolute',
        ...style,
      }}
    />
  );
};
