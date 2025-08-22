// components/Wheel.jsx
import { useMemo, useRef, useState } from "react";

/**
 * Weighted wheel:
 * - Visual wedge size proportional to weight.
 * - Winner picked with the same weights.
 * - Label wraps and clips to its wedge.
 */
export default function Wheel({
  items = [],
  weights = [],
  onResult,
  theme = "light",
}) {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const svgRef = useRef(null);

  // --- Normalize inputs ------------------------------------------------------
  const data = useMemo(() => {
    const clean = (items || []).map((it, i) => ({
      name: (it?.name || "—").trim(),
      item: it,
      w: Math.max(0, Number(weights?.[i] ?? 1)) || 0,
    }));
    // If all weights are 0 or empty, fall back to 1 each
    const sum = clean.reduce((a, b) => a + b.w, 0);
    if (sum <= 0) clean.forEach((d) => (d.w = 1));
    return clean;
  }, [items, weights]);

  const N = data.length || 1;

  // --- Geometry / Angles -----------------------------------------------------
  const { segments, totalWeight } = useMemo(() => {
    const total = data.reduce((a, b) => a + b.w, 0);
    let acc = 0;
    const segs = data.map((d, i) => {
      const sweep = (d.w / total) * 360; // degrees
      const start = acc; // degrees, 0 at 12 o’clock after our -90 shift
      const end = acc + sweep;
      acc = end;
      return { index: i, start, end, sweep, mid: (start + end) / 2, ...d };
    });
    return { segments: segs, totalWeight: total };
  }, [data]);

  // Convert “wheel” angle (0 at top) to SVG rotation math
  const toRadians = (deg) => ((deg - 90) * Math.PI) / 180; // shift -90 so 0deg is 12 o'clock

  const size = 340;
  const r = size / 2;
  const cx = r,
    cy = r;

  // --- Weighted pick consistent with visuals ---------------------------------
  function pickIndexWeighted() {
    let r = Math.random() * totalWeight;
    for (const s of segments) {
      r -= s.w;
      if (r <= 0) return s.index;
    }
    return segments[segments.length - 1].index;
  }

  // --- Wedge path for [start,end] degrees ------------------------------------
  function wedgePath(startDeg, endDeg) {
    const a0 = toRadians(startDeg);
    const a1 = toRadians(endDeg);
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const largeArc = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${largeArc} 1 ${x1} ${y1} Z`;
  }

  // --- Theme colors ----------------------------------------------------------
  function segFill(i) {
    const lightA = "#fef08a",
      lightB = "#93c5fd";
    const darkA = "#1f2937",
      darkB = "#0b1220";
    return theme === "dark"
      ? i % 2 === 0
        ? darkA
        : darkB
      : i % 2 === 0
      ? lightA
      : lightB;
  }

  // --- Label helpers (wrap per-wedge) ----------------------------------------
  function wrapLabel(str, sweepDeg) {
    // Narrow wedges = fewer chars per line
    const perLine =
      sweepDeg >= 90
        ? 20
        : sweepDeg >= 60
        ? 16
        : sweepDeg >= 30
        ? 13
        : sweepDeg >= 20
        ? 11
        : sweepDeg >= 12
        ? 9
        : 7;

    const words = (str || "").split(/\s+/);
    const lines = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? cur + " " + w : w;
      if (next.length <= perLine) cur = next;
      else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    // Limit to 3 lines; ellipsize the last one if needed
    if (lines.length > 3) {
      lines.length = 3;
      const last = lines[2];
      lines[2] =
        last.length > perLine ? last.slice(0, perLine - 1) + "…" : last + "…";
    }
    return lines;
  }

  function fontSizeForSweep(sweepDeg) {
    // Bigger wedge -> bigger font
    if (sweepDeg >= 100) return 16;
    if (sweepDeg >= 70) return 14;
    if (sweepDeg >= 45) return 12;
    if (sweepDeg >= 25) return 11;
    if (sweepDeg >= 15) return 10;
    return 9;
  }

  // Label anchor point: along the wedge centerline, 60% radius
  function centerlinePoint(midDeg, radiusFactor = 0.6) {
    const a = toRadians(midDeg);
    const rr = r * radiusFactor;
    return { x: cx + rr * Math.cos(a), y: cy + rr * Math.sin(a), aRad: a };
  }

  // --- Spin logic with variable wedges ---------------------------------------
  function spin() {
    if (!segments.length || spinning) return;
    setSpinning(true);

    const winnerIdx = pickIndexWeighted();
    const winnerSeg = segments[winnerIdx];

    // We want the wheel to rotate so the winner’s mid lands at 0deg (12 o’clock)
    const targetAtTop = 360 - winnerSeg.mid;
    const spins = 6 + Math.floor(Math.random() * 3);
    const final = spins * 360 + targetAtTop;

    setRotation((prev) => prev + Math.round(final * 10) / 10);

    setTimeout(() => {
      setSpinning(false);
      onResult?.(winnerSeg.item, winnerIdx);
    }, 4600);
  }

  // --- Render ----------------------------------------------------------------
  return (
    <div className="wheel-wrap">
      <div className="pointer">▼</div>

      <svg
        ref={svgRef}
        width={size}
        height={size}
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: `transform ${
            spinning ? 4.5 : 0
          }s cubic-bezier(0.1, 0.9, 0.1, 1)`,
          borderRadius: "50%",
          boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          background: "var(--card)",
        }}
      >
        <defs>
          {segments.map((s) => (
            <clipPath
              key={`clip-${s.index}`}
              id={`clip-${s.index}`}
              clipPathUnits="userSpaceOnUse"
            >
              <path d={wedgePath(s.start, s.end)} />
            </clipPath>
          ))}
        </defs>

        <g>
          {segments.map((s, idx) => {
            const path = wedgePath(s.start, s.end);
            const { x, y } = centerlinePoint(s.mid, 0.6);
            const lines = wrapLabel(s.name, s.sweep);
            const fz = fontSizeForSweep(s.sweep);

            // Rotate label so it reads horizontally relative to tangent? We’ll keep horizontal,
            // but center it on the centerline and clip to wedge.
            return (
              <g key={s.index}>
                <path
                  d={path}
                  style={{ fill: segFill(idx), stroke: "var(--ink)" }}
                  strokeWidth="1"
                />
                <g clipPath={`url(#clip-${s.index})`}>
                  <text
                    x={x}
                    y={y - fz * (lines.length - 1) * 0.575} // vertically center multi-line block
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{
                      fontSize: `${fz}px`,
                      fill: "var(--ink)",
                      fontWeight: 700,
                    }}
                  >
                    {lines.map((line, i) => (
                      <tspan key={i} x={x} dy={i === 0 ? 0 : fz * 1.15}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
      </svg>

      <button
        className="btn"
        onClick={spin}
        disabled={spinning || !segments.length}
      >
        {spinning ? "Spinning..." : "Spin the Wheel"}
      </button>

      <style jsx>{`
        .wheel-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .pointer {
          position: relative;
          top: 12px;
          font-size: 22px;
          color: var(--ink);
          transform: translateY(10px);
          user-select: none;
        }
        .btn {
          margin-top: 10px;
          padding: 10px 16px;
          border: 1px solid var(--line);
          background: var(--btn);
          color: var(--btn-ink);
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        }
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
