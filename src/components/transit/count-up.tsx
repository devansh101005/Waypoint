"use client";

import { useEffect, useRef, useState } from "react";
import { formatFigure, type FigureFormat } from "@/lib/format";

/**
 * A figure that counts up the first time it is seen.
 *
 * The comparison is the point of these numbers, so the baseline underneath
 * fades in only once the count has finished — arriving together, the reader
 * takes in two numbers at once and neither lands.
 *
 * The final value is rendered on the server and during the count, so the figure
 * is never absent: a fast scroller, a screenshot, a printed page and a
 * reduced-motion reader all see the real number immediately.
 */

interface CountUpProps {
  value: number;
  /* A name rather than a function: this is rendered from a Server Component,
     and functions cannot cross that boundary. */
  format: FigureFormat;
  className?: string;
  style?: React.CSSProperties;
  /** Rendered after the count settles. */
  children?: React.ReactNode;
  durationMs?: number;
}

export function CountUp({
  value,
  format,
  className,
  style,
  children,
  durationMs = 900,
}: CountUpProps) {
  const [display, setDisplay] = useState(value);
  const [settled, setSettled] = useState(true);
  const ref = useRef<HTMLParagraphElement>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || hasRun.current) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || hasRun.current) return;
        hasRun.current = true;
        observer.disconnect();

        setSettled(false);
        setDisplay(0);
        const started = performance.now();

        const step = (now: number) => {
          const t = Math.min(1, (now - started) / durationMs);
          // Ease-out: fast at first, settling into the real figure.
          const eased = 1 - Math.pow(1 - t, 3);
          setDisplay(value * eased);
          if (t < 1) requestAnimationFrame(step);
          else {
            setDisplay(value);
            setSettled(true);
          }
        };
        requestAnimationFrame(step);
      },
      { threshold: 0.4 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [value, durationMs]);

  return (
    <>
      <p ref={ref} className={className} style={style}>
        {formatFigure(display, format)}
      </p>
      {children && (
        <span
          style={{
            opacity: settled ? 1 : 0,
            transition: "opacity .45s ease",
          }}
        >
          {children}
        </span>
      )}
    </>
  );
}
