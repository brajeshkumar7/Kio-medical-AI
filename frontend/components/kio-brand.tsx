"use client";

import { useId } from "react";

export default function KioBrandMark({
  size = 36,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const helixGradient = `kio-helix-${id}`;
  const networkGradient = `kio-network-${id}`;

  return (
    <span className={`kio-brand-mark ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 128 128" role="presentation">
        <defs>
          <linearGradient id={helixGradient} x1="22" y1="105" x2="108" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--kio-logo-blue)" />
            <stop offset=".5" stopColor="var(--kio-logo-cyan)" />
            <stop offset="1" stopColor="var(--kio-logo-highlight)" />
          </linearGradient>
          <linearGradient id={networkGradient} x1="16" y1="71" x2="59" y2="15" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--kio-logo-blue)" />
            <stop offset="1" stopColor="var(--kio-logo-cyan)" />
          </linearGradient>
        </defs>

        <g className="kio-network" fill="none" stroke={`url(#${networkGradient})`} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 51 29 30 48 21 59 32 62 49 49 63 31 70 18 51ZM29 30l30 2M18 51l31 12M29 30l2 40M48 21l1 42M59 32 31 70M18 51l44-2M29 30l33 19" />
          <path d="M22 72 31 70 49 63 62 49" opacity=".7" />
          {[[18,51],[29,30],[48,21],[59,32],[62,49],[49,63],[31,70],[22,72]].map(([cx, cy], index) => (
            <circle key={index} cx={cx} cy={cy} r={index % 3 === 0 ? 3.5 : 2.7} fill={`url(#${networkGradient})`} stroke="none" />
          ))}
        </g>

        <g fill="none" stroke={`url(#${helixGradient})`} strokeLinecap="round" strokeLinejoin="round">
          <path className="kio-ribbon" d="M35 105C35 87 53 80 58 65C64 48 51 36 72 19" />
          <path className="kio-ribbon kio-ribbon-secondary" d="M49 109C48 91 68 84 72 68C77 50 65 38 91 24" />
          <path className="kio-branch" d="M60 67C75 54 82 34 105 28C91 40 89 58 70 70" />
          <path className="kio-branch" d="M65 67C77 82 87 100 108 101C93 111 76 100 58 77" />
          <g className="kio-rungs">
            <path d="M38 94 51 97M42 84l14 5M49 75l13 5M56 64l14 4M57 52l16 3M58 40l17 4M64 29l14 4" />
          </g>
        </g>
      </svg>
    </span>
  );
}
