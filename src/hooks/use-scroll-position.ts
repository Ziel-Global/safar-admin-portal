import { useEffect, useState } from "react";

/**
 * Tracks window scrollY using a requestAnimationFrame-throttled scroll listener.
 * Returns the current scroll Y position (0 during SSR / before mount).
 */
export function useScrollPosition() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let ticking = false;
    let rafId = 0;

    const update = () => {
      setScrollY(window.scrollY);
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        rafId = window.requestAnimationFrame(update);
      }
    };

    // Initial value on mount
    setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return scrollY;
}
