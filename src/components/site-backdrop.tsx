"use client";

import { usePathname } from "next/navigation";
import { HeroShader } from "./planner/hero-shader";

const SQRT1_2 = Math.SQRT1_2;

/** Parallel Vignelli transit-route curves: 90° and 45° concentric circular arcs extending past every viewport edge. */
const UPPER_CONTOURS = [0, 22, 44, 66, 88].map((off) => {
  const r1 = 100 + off;
  const r2 = 220 - off;
  const x2 = (780 - r2 * SQRT1_2).toFixed(1);
  const y2 = (440 - r2 * SQRT1_2).toFixed(1);
  const xEnd = (Number(x2) - 760).toFixed(1);
  const yEnd = (Number(y2) + 760).toFixed(1);
  return `M ${1140 + off} -20 V 120 A ${r1} ${r1} 0 0 1 1040 ${220 + off} H 780 A ${r2} ${r2} 0 0 0 ${x2} ${y2} L ${xEnd} ${yEnd}`;
});

const LOWER_CONTOURS = [0, 22, 44, 66].map((off) => {
  const r = 220 - off;
  const x1 = (980 - r * SQRT1_2).toFixed(1);
  const y1 = (780 - r * SQRT1_2).toFixed(1);
  const xStart = (Number(x1) - 460).toFixed(1);
  const yStart = (Number(y1) + 460).toFixed(1);
  return `M ${xStart} ${yStart} L ${x1} ${y1} A ${r} ${r} 0 0 1 980 ${780 - r} H 1480`;
});

const LEFT_MARGIN_CONTOURS = [0, 20, 40].map((off) => {
  const r = 150 - off;
  return `M -20 ${130 + off} H 110 A ${r} ${r} 0 0 1 ${110 + r} 280 V 940`;
});

/**
 * Full-viewport ambient GPU shader + #13 Vignelli transit curves mounted once in the root layout
 * so route transitions stay seamless and timetable export DOM (`calendarRef`) stays clean.
 */
export function SiteBackdrop() {
  const pathname = usePathname();
  // Quiet down line contrast on long-form editorial prose so paragraphs remain effortless to read.
  const quiet = pathname === "/about";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{
        maskImage: "radial-gradient(ellipse 135% 135% at 52% 45%, #000 72%, rgb(0 0 0 / 0.55) 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 135% 135% at 52% 45%, #000 72%, rgb(0 0 0 / 0.55) 100%)",
      }}
    >
      <HeroShader className="absolute inset-0 opacity-90" />
      <svg className="relative h-full w-full" viewBox="0 0 1440 900" fill="none" preserveAspectRatio="xMidYMid slice">
        <g className={`text-ink transition-opacity duration-300 ${quiet ? "opacity-[0.06]" : "opacity-[0.15]"}`}>
          {[...UPPER_CONTOURS, ...LOWER_CONTOURS, ...LEFT_MARGIN_CONTOURS].map((d, i) => (
            <path key={i} d={d} stroke="currentColor" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
        {/* Single Vignelli magenta transit trunk line accenting the upper contour bundle */}
        <path
          d={UPPER_CONTOURS[2]}
          className={`text-accent transition-opacity duration-300 ${quiet ? "opacity-[0.09]" : "opacity-[0.18]"}`}
          stroke="currentColor"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx="1040"
          cy="264"
          r="3.5"
          className={`fill-canvas stroke-accent transition-opacity duration-300 ${quiet ? "opacity-[0.16]" : "opacity-[0.3]"}`}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx="980"
          cy="582"
          r="3.5"
          className={`fill-canvas stroke-ink transition-opacity duration-300 ${quiet ? "opacity-[0.12]" : "opacity-[0.22]"}`}
          strokeWidth={1.25}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
