"use client";

import { useEffect, useRef, useState } from "react";


export type AgentState = "idle" | "active";

type Particle = {
  angle: number;
  radius: number;
  speed: number;
  size: number;
  depth: number;
};

const NODES = [
  [-0.72, -0.52],
  [-0.48, -0.72],
  [-0.2, -0.62],
  [-0.58, -0.27],
  [-0.3, -0.34],
  [-0.06, -0.43],
  [-0.42, -0.02],
  [-0.12, -0.08],
];

const EDGES = [
  [0, 1], [0, 3], [1, 2], [1, 4], [2, 4], [2, 5],
  [3, 4], [3, 6], [4, 5], [4, 6], [4, 7], [5, 7], [6, 7],
];


function createParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, index) => ({
    angle: (index / count) * Math.PI * 2,
    radius: 86 + (index % 7) * 5,
    speed: 0.00016 + (index % 5) * 0.000018,
    size: 0.8 + (index % 4) * 0.45,
    depth: (index % 9) / 9,
  }));
}

function drawKioCanvasMark(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  unit: number,
  state: AgentState,
  time: number,
  reduceMotion: boolean,
) {
  const breathe = reduceMotion ? 1 : 1 + Math.sin(time * Math.PI / 2000) * 0.015;
  const scale = 1.35 * unit * breathe;
  const gradient = context.createLinearGradient(-48, 54, 56, -56);
  gradient.addColorStop(0, "#94a3b8");
  gradient.addColorStop(0.55, "#f8fafc");
  gradient.addColorStop(1, "#ffffff");

  context.save();
  context.translate(centerX, centerY);
  context.scale(scale, scale);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.shadowColor = "#ffffff";
  context.shadowBlur = state === "active" ? 12 : 6;

  const networkNodes = [
    [-42, -20], [-32, -41], [-12, -49], [2, -37],
    [5, -19], [-9, -5], [-29, 2], [-39, 4],
  ];
  const networkEdges = [
    [0, 1], [0, 4], [0, 6], [1, 2], [1, 3], [1, 6],
    [2, 3], [2, 5], [3, 4], [3, 6], [4, 5], [5, 6], [6, 7],
  ];
  context.strokeStyle = "rgba(255, 255, 255, .58)";
  context.lineWidth = 1.15;
  networkEdges.forEach(([from, to]) => {
    context.beginPath();
    context.moveTo(networkNodes[from][0], networkNodes[from][1]);
    context.lineTo(networkNodes[to][0], networkNodes[to][1]);
    context.stroke();
  });
  networkNodes.forEach(([x, y], index) => {
    context.beginPath();
    context.arc(x, y, index % 3 === 0 ? 2.5 : 1.8, 0, Math.PI * 2);
    context.fillStyle = index < 3 ? "#cbd5e1" : "#ffffff";
    context.fill();
  });

  context.strokeStyle = gradient;
  context.lineWidth = 6;
  context.beginPath();
  context.moveTo(-30, 48);
  context.bezierCurveTo(-31, 29, -10, 21, -5, 5);
  context.bezierCurveTo(1, -12, -13, -25, 12, -50);
  context.stroke();

  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(-17, 51);
  context.bezierCurveTo(-18, 34, 5, 25, 9, 9);
  context.bezierCurveTo(14, -10, 2, -23, 28, -45);
  context.stroke();

  context.lineWidth = 6;
  context.beginPath();
  context.moveTo(-3, 8);
  context.bezierCurveTo(14, -3, 23, -29, 48, -39);
  context.bezierCurveTo(34, -26, 29, -5, 8, 12);
  context.stroke();
  context.beginPath();
  context.moveTo(1, 10);
  context.bezierCurveTo(15, 27, 27, 46, 51, 45);
  context.bezierCurveTo(34, 56, 16, 43, -5, 19);
  context.stroke();

  context.shadowBlur = 2;
  context.lineWidth = 1.7;
  [[-27,39,-16,42],[-23,30,-11,35],[-16,21,-3,27],[-9,10,5,15],[-7,-2,8,2],[-8,-14,7,-10],[-2,-26,12,-21]].forEach(([x1,y1,x2,y2]) => {
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
  });
  context.restore();
}


function drawFrame(
  context: CanvasRenderingContext2D,
  particles: Particle[],
  width: number,
  height: number,
  time: number,
  state: AgentState,
  reduceMotion: boolean,
) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const centerX = width / 2;
  const centerY = height / 2;
  const unit = Math.min(width, height) / 320;
  const motionTime = reduceMotion ? 0 : time;

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);

  const aura = context.createRadialGradient(centerX, centerY, 5, centerX, centerY, 145 * unit);
  aura.addColorStop(0, state === "active" ? "rgba(255,255,255,.14)" : "rgba(255,255,255,.07)");
  aura.addColorStop(0.55, "rgba(148,163,184,.05)");
  aura.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = aura;
  context.fillRect(0, 0, width, height);

  if (state === "active") {
    for (let index = 0; index < 3; index += 1) {
      const phase = ((motionTime + index * 660) % 2000) / 2000;
      const radius = (48 + phase * 96) * unit;
      context.beginPath();
      context.ellipse(centerX, centerY, radius, radius * 0.48, -0.18, 0, Math.PI * 2);
      context.strokeStyle = `rgba(255,255,255,${(1 - phase) * 0.3})`;
      context.lineWidth = Math.max(0.6, 1.2 * unit);
      context.stroke();
    }
  }

  const pulseEdge = Math.floor(motionTime / 115) % EDGES.length;
  EDGES.forEach(([from, to], index) => {
    const fromNode = NODES[from];
    const toNode = NODES[to];
    context.beginPath();
    context.moveTo(centerX + fromNode[0] * 105 * unit, centerY + fromNode[1] * 105 * unit);
    context.lineTo(centerX + toNode[0] * 105 * unit, centerY + toNode[1] * 105 * unit);
    context.strokeStyle = state === "active" && index === pulseEdge
      ? "rgba(255,255,255,.95)"
      : "rgba(203,213,225,.2)";
    context.lineWidth = index === pulseEdge ? 1.5 : 0.7;
    context.stroke();
  });

  NODES.forEach(([nodeX, nodeY], index) => {
    const jitter = reduceMotion ? 0.55 : 0.3 + (Math.sin(motionTime * 0.0012 + index * 1.8) + 1) * 0.25;
    const x = centerX + nodeX * 105 * unit;
    const y = centerY + nodeY * 105 * unit;
    context.beginPath();
    context.arc(x, y, (index % 3 === 0 ? 3.2 : 2.1) * unit, 0, Math.PI * 2);
    context.fillStyle = `rgba(255,255,255,${jitter})`;
    context.fill();
  });

  if (state === "active") {
    particles.forEach((particle, index) => {
      const angle = particle.angle + motionTime * particle.speed;
      const wobble = Math.sin(angle * 2 + index) * 7 * unit;
      const x = centerX + Math.cos(angle) * (particle.radius * unit + wobble);
      const y = centerY + Math.sin(angle) * particle.radius * unit * (0.38 + particle.depth * 0.08);
      const alpha = 0.25 + particle.depth * 0.7;
      context.beginPath();
      context.arc(x, y, particle.size * unit, 0, Math.PI * 2);
      context.fillStyle = index % 8 === 0
        ? `rgba(203,213,225,${alpha})`
        : `rgba(255,255,255,${alpha})`;
      context.shadowColor = "#ffffff";
      context.shadowBlur = 8 * unit;
      context.fill();
      context.shadowBlur = 0;
    });
  }

  drawKioCanvasMark(context, centerX, centerY, unit, state, motionTime, reduceMotion);
}


export function KioAnimatedMark({
  state = "active",
  size = 44,
  className = "",
  label = "Loading",
}: {
  state?: AgentState;
  size?: number;
  className?: string;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const particles = createParticles(size < 40 ? 28 : 52);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let visible = true;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
    };

    const render = (time: number) => {
      if (visible) {
        const rect = canvas.getBoundingClientRect();
        drawFrame(context, particles, rect.width, rect.height, time, state, reduceMotion);
      }
      if (!reduceMotion) frame = window.requestAnimationFrame(render);
    };

    const handleVisibility = () => {
      visible = document.visibilityState === "visible";
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    document.addEventListener("visibilitychange", handleVisibility);
    resize();
    if (reduceMotion) render(0);
    if (!reduceMotion) frame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [size, state]);

  return (
    <span
      className={`kio-animated-mark ${className}`}
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "visible",
        verticalAlign: "middle",
      }}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      <canvas ref={canvasRef} className="kio-agent-canvas" style={{ display: "block", width: "100%", height: "100%" }} />
      <style jsx>{markStyles}</style>
    </span>
  );
}


export function KioLoadingIndicator({
  label = "Loading",
  size = "section",
  className = "",
}: {
  label?: string;
  size?: "control" | "inline" | "section" | "page";
  className?: string;
}) {
  const markSizes = { control: 30, inline: 44, section: 58, page: 96 };
  const stacked = size === "section" || size === "page";

  return (
    <div
      className={`kio-loading-indicator kio-loading-${size} ${className}`}
      style={{
        width: "fit-content",
        maxWidth: "100%",
        margin: stacked ? "0 auto" : undefined,
        display: "flex",
        flexDirection: stacked ? "column" : "row",
        alignItems: "center",
        justifyContent: "center",
        gap: size === "page" ? 14 : 10,
        textAlign: "center",
      }}
      role="status"
      aria-live="polite"
    >
      <KioAnimatedMark size={markSizes[size]} label="" />
      {label && (
        <span className="kio-loading-label" style={{ display: "block", width: "100%", textAlign: "center", whiteSpace: "nowrap" }}>
          {label}
        </span>
      )}
      <style jsx>{loadingStyles}</style>
    </div>
  );
}


export default function KioAgentLoader({
  state = "active",
  className = "",
}: {
  state?: AgentState;
  className?: string;
}) {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (state !== "active") return;
    const startedAt = performance.now();
    setElapsedMs(0);
    const timer = window.setInterval(() => {
      setElapsedMs(performance.now() - startedAt);
    }, 100);
    return () => window.clearInterval(timer);
  }, [state]);

  const elapsedSeconds = elapsedMs / 1000;
  const elapsedLabel = elapsedSeconds < 10 ? `${elapsedSeconds.toFixed(1)}s` : `${Math.floor(elapsedSeconds)}s`;

  return (
    <div className={`kio-thinking ${className}`} role="status" aria-live="polite" aria-label="KIO is thinking">
      <KioAnimatedMark state={state} size={44} label="" />
      <div className="kio-thinking-copy">
        <span className="kio-thinking-label">Thinking<span className="kio-thinking-dots" /></span>
        <time aria-hidden="true" dateTime={`PT${Math.max(0, elapsedSeconds).toFixed(1)}S`}>{elapsedLabel}</time>
      </div>
      <style jsx>{agentStyles}</style>
    </div>
  );
}


const agentStyles = `
  .kio-thinking {
    min-height: 48px;
    width: max-content;
    display: inline-grid;
    grid-template-columns: 44px max-content;
    align-items: center;
    gap: 11px;
    color: var(--ink);
    white-space: nowrap;
  }
  .kio-thinking-copy {
    min-width: 0;
    display: inline-flex;
    align-items: baseline;
    gap: 8px;
  }
  .kio-thinking-label { font-size: 14px; font-weight: 500; }
  .kio-thinking-copy time {
    color: var(--muted);
    font: 400 12px/1 var(--font-sans);
  }
  .kio-thinking-dots::after {
    content: "";
    display: inline-block;
    width: 1.2em;
    animation: thinking-dots 1.35s steps(4, end) infinite;
  }
  @keyframes thinking-dots {
    0% { content: ""; }
    25% { content: "."; }
    50% { content: ".."; }
    75%, 100% { content: "..."; }
  }
  @media (prefers-reduced-motion: reduce) {
    .kio-thinking-dots::after { animation: none; content: "..."; }
  }
`;

const markStyles = `
  .kio-animated-mark {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: visible;
    border: 0;
    background: transparent;
    box-shadow: none;
  }
  .kio-agent-canvas {
    display: block;
    width: 100%;
    height: 100%;
    background: transparent;
    transition: filter .2s;
  }
`;

const loadingStyles = `
  .kio-loading-indicator {
    width: max-content;
    max-width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-width: 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.4;
    text-align: center;
  }
  .kio-loading-section,
  .kio-loading-page { flex-direction: column; }
  .kio-loading-page { gap: 14px; font-size: 14px; }
  .kio-loading-label {
    display: block;
    width: 100%;
    text-align: center;
    white-space: nowrap;
  }
`;
