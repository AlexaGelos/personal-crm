"use client";

import { useEffect, useRef } from "react";

// How the light trails the mouse: in this many milliseconds it covers about two thirds
// of the way left, like a candle carried in a hand
const LAG_MS = 70;

// The candle the mouse carries: soft warm light around the cursor, over everything on the
// page. It flickers, goes out and flares up together with the other candles (`candle-light`,
// `candle-glow`, see globals.css) and goes out last in the wave, after the right sconce.
// Only for a mouse: phones and tablets get no light. With reduced motion the light stays
// right under the cursor and does not flicker.
export function CursorLight() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const light = ref.current;
    if (!light) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let target = { x: 0, y: 0 };
    let at = target;
    let frame = 0;
    let lastTime = 0;

    const place = () => {
      light.style.transform = `translate3d(${at.x}px, ${at.y}px, 0)`;
    };

    const follow = (time: number) => {
      const share = reducedMotion.matches
        ? 1
        : 1 - Math.exp(-Math.max(time - lastTime, 0) / LAG_MS);
      lastTime = time;
      at = { x: at.x + (target.x - at.x) * share, y: at.y + (target.y - at.y) * share };
      if (Math.abs(target.x - at.x) < 0.5 && Math.abs(target.y - at.y) < 0.5) {
        at = target;
        frame = 0;
      } else {
        frame = requestAnimationFrame(follow);
      }
      place();
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      target = { x: event.clientX, y: event.clientY };
      // The light comes on where the mouse enters, it does not fly in from where it went out
      if (!light.hasAttribute("data-lit")) {
        cancelAnimationFrame(frame);
        frame = 0;
        at = target;
        place();
        light.setAttribute("data-lit", "");
        return;
      }
      if (!frame) {
        lastTime = performance.now();
        frame = requestAnimationFrame(follow);
      }
    };

    // Nothing to go to: the mouse has left the window
    const onOut = (event: MouseEvent) => {
      if (!event.relatedTarget) light.removeAttribute("data-lit");
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("mouseout", onOut);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("mouseout", onOut);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-30 opacity-0 mix-blend-screen transition-opacity duration-700 data-lit:opacity-100"
    >
      <div
        className="candle-glow absolute size-90 -translate-1/2"
        style={{ "--snuff-delay": "0.9s" } as React.CSSProperties}
      >
        <div className="candle-light absolute inset-0 rounded-full bg-(image:--glow-cursor)" />
      </div>
    </div>
  );
}
