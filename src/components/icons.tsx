import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

/** Triangle warning glyph paired with Danger Red clash badges so states never rely on color alone. */
export function WarningIcon({ className = "size-4 shrink-0", ...props }: IconProps) {
  return (
    <svg {...base} className={className} {...props}>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </svg>
  );
}

/** Checkmark glyph for clash-free plan indicators and scannable bullet points. */
export function CheckIcon({ className = "size-4 shrink-0", ...props }: IconProps) {
  return (
    <svg {...base} className={className} {...props}>
      <path d="M5 12.5 9.5 17 19 7.5" />
    </svg>
  );
}

/** Circle-check glyph for reassuring empty/clean status banners and RAG tips. */
export function CheckCircleIcon({ className = "size-4 shrink-0", ...props }: IconProps) {
  return (
    <svg {...base} className={className} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </svg>
  );
}

/** Speaker-with-wave glyph for opt-in micro-sound feedback when enabled. */
export function VolumeOnIcon({ className = "size-4 shrink-0", ...props }: IconProps) {
  return (
    <svg {...base} className={className} {...props}>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

/** Muted speaker glyph (default state). */
export function VolumeOffIcon({ className = "size-4 shrink-0", ...props }: IconProps) {
  return (
    <svg {...base} className={className} {...props}>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="m21 9-6 6" />
      <path d="m15 9 6 6" />
    </svg>
  );
}

/** Compact step/hint glyph for RAG answer bullet lists and onboarding cues. */
export function ArrowRightIcon({ className = "size-4 shrink-0", ...props }: IconProps) {
  return (
    <svg {...base} className={className} {...props}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}
