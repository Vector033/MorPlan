import { useEffect, useRef } from "react";

/** When `show` turns true, moves focus to the element (give it tabIndex={-1}) and scrolls it into view. */
export function useReveal<T extends HTMLElement>(show: boolean) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!show || !el) return;
    el.focus({ preventScroll: true });
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" });
  }, [show]);
  return ref;
}
