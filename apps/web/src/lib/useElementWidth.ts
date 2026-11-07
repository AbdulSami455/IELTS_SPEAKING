import { useEffect, useState } from "react";

// Tracks an element's rendered width so SVG charts can draw in real pixels
// (keeping labels legible) instead of scaling a fixed viewBox down on phones.
// Pass the returned callback as the element's `ref`.
export function useElementWidth<T extends HTMLElement>(fallback: number) {
  const [element, setElement] = useState<T | null>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    if (!element) return;
    const update = () => setWidth(Math.round(element.getBoundingClientRect().width) || fallback);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, fallback]);

  return [setElement, width] as const;
}
