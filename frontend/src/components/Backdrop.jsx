import React, { memo } from 'react';

/**
 * The app backdrop.
 *
 * Four layers, all inert and pointer-transparent:
 *   1. an engraved two-scale grid that dissolves toward the bottom,
 *   2. drifting topographic ridges drawn as SVG paths,
 *   3. two soft light pools that breathe on a long loop,
 *   4. a film-grain overlay that removes banding from the soft fills.
 *
 * Only transform and opacity animate, so the compositor handles the whole thing
 * and scrolling stays smooth. `prefers-reduced-motion` freezes the movement in
 * index.css without removing the texture.
 */

const RIDGE_LINES = [
  { d: 'M0,120 C160,80 320,150 480,110 C640,70 800,140 960,105 C1120,70 1280,135 1440,100', opacity: 0.9, delay: '0s' },
  { d: 'M0,160 C170,125 330,190 500,155 C670,120 830,185 1000,150 C1170,115 1300,175 1440,145', opacity: 0.7, delay: '-8s' },
  { d: 'M0,205 C150,175 340,235 500,200 C660,165 840,230 1010,195 C1180,160 1320,215 1440,190', opacity: 0.55, delay: '-16s' },
  { d: 'M0,250 C180,225 350,280 520,248 C690,216 860,272 1030,242 C1200,212 1330,258 1440,235', opacity: 0.4, delay: '-24s' },
];

export const Backdrop = memo(function Backdrop() {
  return (
    <div className="backdrop-root" aria-hidden="true">
      <div className="backdrop-grid" />

      <div className="backdrop-bloom backdrop-bloom-a animate-drift-a" />
      <div className="backdrop-bloom backdrop-bloom-b animate-drift-b" />

      <div className="backdrop-ridges">
        <svg
          viewBox="0 0 1440 300"
          preserveAspectRatio="none"
          className="h-full w-full"
          fill="none"
        >
          {RIDGE_LINES.map((line) => (
            <g key={line.d} style={{ animation: `driftA 34s ease-in-out infinite`, animationDelay: line.delay }}>
              <path
                d={line.d}
                stroke="var(--ridge-stroke)"
                strokeWidth="1.25"
                strokeLinecap="round"
                opacity={line.opacity}
              />
            </g>
          ))}
        </svg>
      </div>

      <div className="backdrop-grain" />
    </div>
  );
});

export default Backdrop;
