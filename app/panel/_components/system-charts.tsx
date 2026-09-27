"use client";

import { useEffect, useId, useState } from "react";
import { formatBytes } from "@/app/panel/media/_lib";
import type { SystemStatus } from "@/lib/status";

/** History window: SAMPLE_MS x SAMPLES ≈ the last 2.5 minutes. */
const SAMPLE_MS = 4000;
const SAMPLES = 40;

const INDIGO = "#4353e8";
const LIME = "#82b424";

const HIGH = 90;

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

/** Filled line chart over a fixed 0–100% domain. */
function Sparkline({ points, color }: { points: number[]; color: string }) {
  const gradientId = useId();
  const width = 260;
  const height = 64;
  const step = width / (SAMPLES - 1);
  const toY = (value: number) => height - 3 - (clampPercent(value) / 100) * (height - 8);
  const coords = points.map((value, index) => `${(index * step).toFixed(1)},${toY(value).toFixed(1)}`);
  const line = `M${coords.join(" L")}`;
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.26" />
          <stop offset="1" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[25, 50, 75].map((mark) => (
        <line key={mark} className="chart-grid" x1="0" x2={width} y1={toY(mark)} y2={toY(mark)} />
      ))}
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Ring gauge with the value in the middle. */
function Donut({ percent, color }: { percent: number; color: string }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const clamped = clampPercent(percent);
  return (
    <svg className="chart-donut" viewBox="0 0 90 90" role="img" aria-label={`${Math.round(clamped)}% used`}>
      <circle cx="45" cy="45" r={radius} fill="none" stroke="#e8ece9" strokeWidth="9" />
      <circle
        cx="45"
        cy="45"
        r={radius}
        fill="none"
        stroke={clamped >= HIGH ? "#c2503e" : color}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${(circumference * clamped) / 100} ${circumference}`}
        transform="rotate(-90 45 45)"
      />
    </svg>
  );
}

function ChartHead({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <header className="status-head">
      <span className="status-title">{title}</span>
      <div className="chart-head-value">
        <strong>{value}</strong>
        <small>{sub}</small>
      </div>
    </header>
  );
}

/**
 * CPU, memory and disk cards with live charts. Samples arrive from the
 * admin status endpoint every few seconds; the sparkline histories are
 * seeded with the server-rendered value so the charts draw immediately.
 */
export default function SystemCharts({ initial }: { initial: SystemStatus }) {
  const [cpu, setCpu] = useState<number[]>(() => Array(SAMPLES).fill(initial.cpuPercent));
  const [ram, setRam] = useState<number[]>(() => Array(SAMPLES).fill((initial.ramUsed / initial.ramTotal) * 100));
  const [latest, setLatest] = useState<SystemStatus>(initial);

  useEffect(() => {
    let alive = true;
    async function sample() {
      // Background tabs do not need fresh pixels.
      if (document.visibilityState === "hidden") return;
      try {
        const response = await fetch("/api/admin/system-status", { cache: "no-store" });
        if (!response.ok) return;
        const data: SystemStatus = await response.json();
        if (!alive) return;
        setLatest(data);
        setCpu((previous) => [...previous.slice(1), data.cpuPercent]);
        setRam((previous) => [...previous.slice(1), (data.ramUsed / data.ramTotal) * 100]);
      } catch {
        // Transient network or auth hiccups just skip a sample.
      }
    }
    const id = setInterval(sample, SAMPLE_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const ramPercent = (latest.ramUsed / latest.ramTotal) * 100;
  const diskPercent = latest.diskTotal ? (latest.diskUsed / latest.diskTotal) * 100 : 0;

  return (
    <>
      <article className="status-card" aria-labelledby="status-cpu">
        <ChartHead title="CPU" value={`${latest.cpuPercent}%`} sub={`${latest.cores} cores · 1 min avg`} />
        <Sparkline points={cpu} color={INDIGO} />
        <p className="chart-note">Live · last {Math.round((SAMPLES * SAMPLE_MS) / 1000 / 60)} min</p>
      </article>

      <article className="status-card" aria-labelledby="status-memory">
        <ChartHead title="MEMORY" value={formatBytes(latest.ramUsed)} sub={`of ${formatBytes(latest.ramTotal)}`} />
        <Sparkline points={ram} color={LIME} />
        <p className="chart-note">Live · {Math.round(ramPercent)}% in use</p>
      </article>

      <article className="status-card status-card-donut" aria-labelledby="status-disk">
        <ChartHead title="DISK" value={formatBytes(latest.diskUsed)} sub={`of ${formatBytes(latest.diskTotal)}`} />
        <div className="chart-donut-wrap">
          <Donut percent={diskPercent} color={INDIGO} />
          <div className="chart-donut-center">
            <strong>{Math.round(diskPercent)}%</strong>
            <small>used</small>
          </div>
        </div>
        <p className="chart-note">Refreshes with the page</p>
      </article>
    </>
  );
}
