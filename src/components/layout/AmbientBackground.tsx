import { useEffect, useRef } from 'react';

export function AmbientBackground() {
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = { x: 0.5, y: 0.25 };
    const current = { x: target.x, y: target.y };
    const reducedMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let running = false;

    const pointerMove = (event: PointerEvent) => {
      target.x = event.clientX / Math.max(window.innerWidth, 1);
      target.y = event.clientY / Math.max(window.innerHeight, 1);
      if (!running && !reducedMotion) {
        running = true;
        frame = requestAnimationFrame(tick);
      }
    };
    const tick = () => {
      current.x += (target.x - current.x) * 0.07;
      current.y += (target.y - current.y) * 0.07;
      layer.current?.style.setProperty('--pointer-x', `${current.x * 100}%`);
      layer.current?.style.setProperty('--pointer-y', `${current.y * 100}%`);
      layer.current?.style.setProperty('--pointer-hue', `${(current.x - 0.5) * 18}deg`);
      if (Math.abs(target.x - current.x) + Math.abs(target.y - current.y) > 0.001) {
        frame = requestAnimationFrame(tick);
      } else running = false;
    };
    if (!reducedMotion) window.addEventListener('pointermove', pointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', pointerMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return <div ref={layer} className="ambient-background" aria-hidden="true" />;
}
