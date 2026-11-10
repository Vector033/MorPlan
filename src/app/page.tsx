import { HeroShader } from "@/components/planner/hero-shader";
import { Planner } from "@/components/planner/planner";

const SQRT1_2 = Math.SQRT1_2;

/** Parallel Vignelli transit-route curves: 90° and 45° concentric circular arcs across margins & hero. */
const UPPER_CONTOURS = [0, 22, 44, 66, 88].map((off) => {
  const r1 = 100 + off;
  const r2 = 220 - off;
  const x2 = (780 - r2 * SQRT1_2).toFixed(1);
  const y2 = (440 - r2 * SQRT1_2).toFixed(1);
  const xEnd = (Number(x2) - 520).toFixed(1);
  const yEnd = (Number(y2) + 520).toFixed(1);
  return `M ${1140 + off} -20 V 120 A ${r1} ${r1} 0 0 1 1040 ${220 + off} H 780 A ${r2} ${r2} 0 0 0 ${x2} ${y2} L ${xEnd} ${yEnd}`;
});

const LOWER_CONTOURS = [0, 22, 44, 66].map((off) => {
  const r = 220 - off;
  const x1 = (980 - r * SQRT1_2).toFixed(1);
  const y1 = (780 - r * SQRT1_2).toFixed(1);
  const xStart = (Number(x1) - 420).toFixed(1);
  const yStart = (Number(y1) + 420).toFixed(1);
  return `M ${xStart} ${yStart} L ${x1} ${y1} A ${r} ${r} 0 0 1 980 ${780 - r} H 1480`;
});

const LEFT_MARGIN_CONTOURS = [0, 20, 40].map((off) => {
  const r = 130 + off;
  return `M -20 ${130 + off} H 110 A ${r} ${r} 0 0 1 ${110 + r} 260 V 920`;
});

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col">
      {/* GPU Simplex contour shader + #13 Vignelli transit curves behind the hero (outside calendarRef). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[min(88vh,820px)] overflow-hidden"
        style={{
          maskImage: "radial-gradient(ellipse 98% 90% at 54% 40%, #000 54%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 98% 90% at 54% 40%, #000 54%, transparent 100%)",
        }}
      >
        <HeroShader className="absolute inset-0 opacity-90" />
        <svg className="relative h-full w-full" viewBox="0 0 1440 900" fill="none" preserveAspectRatio="xMidYMin slice">
          <g className="text-ink opacity-[0.15]">
            {[...UPPER_CONTOURS, ...LOWER_CONTOURS, ...LEFT_MARGIN_CONTOURS].map((d, i) => (
              <path key={i} d={d} stroke="currentColor" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
          {/* Single Vignelli magenta transit trunk line accenting the upper contour bundle */}
          <path
            d={UPPER_CONTOURS[2]}
            className="text-accent opacity-[0.18]"
            stroke="currentColor"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <circle cx="1040" cy="264" r="3.5" className="fill-canvas stroke-accent opacity-[0.3]" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <circle cx="980" cy="582" r="3.5" className="fill-canvas stroke-ink opacity-[0.22]" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="relative z-10 flex flex-1 flex-col">
        <Planner />
      </div>
    </div>
  );
}
