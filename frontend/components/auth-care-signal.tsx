"use client";


const SIGNAL_PATH = "M24 74 H142 C158 74 162 58 176 58 C190 58 194 74 210 74 H278 L292 74 L306 40 L324 112 L344 58 L360 74 H696";


export default function AuthCareSignal() {
  return (
    <div className="auth-care-signal" aria-hidden="true">
      <svg viewBox="0 0 720 230" role="presentation" preserveAspectRatio="xMidYMid meet">
        <g className="auth-signal-grid">
          {[40, 88, 136, 184].map((y) => <path key={y} d={`M24 ${y} H696`} />)}
          {[96, 210, 360, 510, 624].map((x) => <path key={x} d={`M${x} 24 V204`} />)}
        </g>

        <path className="auth-signal-rail" d={SIGNAL_PATH} />
        <path className="auth-signal-energy" d={SIGNAL_PATH} />

        <g className="auth-context-links">
          <path d="M96 74 148 154 236 178 360 158 484 180 570 150 624 74" />
          <path d="M148 154 236 126 360 158 484 132 570 150" />
          <path d="M236 178 236 126M484 180 484 132" />
        </g>

        <g className="auth-context-nodes">
          {[
            [96, 74], [148, 154], [236, 178], [236, 126], [360, 158],
            [484, 180], [484, 132], [570, 150], [624, 74],
          ].map(([cx, cy], index) => (
            <g key={`${cx}-${cy}`} className={`auth-context-node auth-context-node-${index % 4}`}>
              <circle className="auth-node-halo" cx={cx} cy={cy} r="11" />
              <circle className="auth-node-core" cx={cx} cy={cy} r={index === 4 ? 4.5 : 3.2} />
            </g>
          ))}
        </g>

        <circle className="auth-signal-runner" r="4">
          <animateMotion dur="8s" repeatCount="indefinite" path={SIGNAL_PATH} />
        </circle>
      </svg>
    </div>
  );
}
