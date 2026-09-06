"use client";
import { useEffect, useMemo, useState } from "react";
import { PIN_LABELS, STICK_X, STICK_Y, parseSteps } from "@/lib/gpc";

export default function ScriptPreview({ body }: { body: string }) {
  const steps = useMemo(() => parseSteps(body), [body]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    setIdx(0);
    setPlaying(false);
  }, [body]);

  useEffect(() => {
    if (!playing || idx >= steps.length - 1) return;
    const stepT = idx < 0 ? 0 : steps[idx].t;
    const nextT = steps[Math.min(idx + 1, steps.length - 1)].t;
    const delay = Math.max(80, Math.min(1400, Math.max(80, nextT - stepT) / speed));
    const timer = setTimeout(() => setIdx((i) => i + 1), delay);
    return () => clearTimeout(timer);
  }, [playing, idx, speed, steps]);

  useEffect(() => {
    if (playing && idx >= steps.length - 1) setPlaying(false);
  }, [idx, playing, steps.length]);

  const current = steps[idx];
  let dx = 0;
  let dy = 0;
  if (current?.pin && typeof current.value === "number") {
    const off = Math.max(-1, Math.min(1, (current.value - 50) / 50));
    if (STICK_X.test(current.pin)) dx = off * 36;
    if (STICK_Y.test(current.pin)) dy = off * 36;
  }

  if (steps.length === 0) {
    return (
      <div className="preview-empty">
        Couldn&apos;t infer a step timeline from this source — it likely relies on
        dynamic input. Use the source view instead.
      </div>
    );
  }

  return (
    <div className="preview">
      <div className="preview-body">
        <div className="stick-view" aria-hidden="true">
          <svg viewBox="0 0 120 120" width="120" height="120">
            <circle cx="60" cy="60" r="48" fill="rgba(241,234,255,0.04)" stroke="var(--border-strong)" />
            <line x1="60" y1="12" x2="60" y2="108" stroke="var(--border)" strokeWidth="1" />
            <line x1="12" y1="60" x2="108" y2="60" stroke="var(--border)" strokeWidth="1" />
            <g style={{ transform: `translate(${dx}px, ${dy}px)`, transition: "transform 140ms ease" }}>
              <circle cx="60" cy="60" r="26" fill="var(--surface-2)" stroke="var(--teal)" strokeWidth="2" />
              <circle cx="60" cy="60" r="10" fill="var(--teal)" />
            </g>
          </svg>
          <span className="stick-label">{current.pin ? PIN_LABELS[current.pin] || current.pin : "—"}</span>
        </div>

        <div className="preview-steps">
          <div className="preview-controls">
            <button className="btn-small" onClick={() => setPlaying((p) => !p)} disabled={idx >= steps.length - 1}>
              {playing ? "Pause" : "Play"}
            </button>
            <button className="btn-small" onClick={() => { setPlaying(false); setIdx(0); }}>Reset</button>
            <span className="speed-c">{[1, 2, 4].map((s) => (
              <button key={s} className={`btn-small${speed === s ? " is-on" : ""}`} onClick={() => setSpeed(s)}>
                {s}×
              </button>
            ))}</span>
          </div>
          <p className="step-pos">
            step {Math.min(idx + 1, steps.length)}/{steps.length} · t={current.t}ms
          </p>
          <ol className="step-list">
            {steps.map((s, i) => (
              <li key={i} className={i === idx ? "is-active" : ""}>
                <span className="step-t">{s.t}ms</span>
                {s.label}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}