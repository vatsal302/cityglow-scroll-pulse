import { useEffect, useState } from "react";

const TITLE = "Conduct the city's light.";

export function HudTitle() {
  // split into chars but keep words intact
  const words = TITLE.split(" ");
  let charIndex = 0;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6">
      <div className="text-center max-w-5xl">
        <h1
          className="font-display text-foreground leading-[1.05] tracking-[-0.025em]"
          style={{
            fontSize: "clamp(2.75rem, 7.2vw, 6rem)",
            fontWeight: 300,
          }}
        >
          {words.map((w, wi) => (
            <span key={wi} className="inline-block whitespace-nowrap">
              {w.split("").map((ch) => {
                const delay = 0.8 + charIndex * 0.035;
                charIndex++;
                return (
                  <span
                    key={charIndex}
                    className="char-mask"
                    style={{ ["--char-delay" as string]: `${delay}s` }}
                  >
                    <span>{ch}</span>
                  </span>
                );
              })}
              {wi < words.length - 1 && (
                <span
                  className="char-mask"
                  style={{ ["--char-delay" as string]: `${0.8 + charIndex * 0.035}s` }}
                >
                  <span>&nbsp;</span>
                </span>
              )}
            </span>
          ))}
        </h1>
        <p
          className="ui-fade mt-6 text-foreground/80 font-sans"
          style={{
            ["--ui-delay" as string]: "1.5s",
            ["--target-opacity" as string]: "0.85",
            fontSize: "clamp(0.95rem, 1.2vw, 1.125rem)",
            letterSpacing: "0.01em",
          }}
        >
          Scroll to move through time. Click to cut the power.
        </p>
      </div>
    </div>
  );
}

export function HudEyebrow() {
  return (
    <div
      className="ui-fade pointer-events-none absolute left-6 top-6 md:left-10 md:top-10 font-mono uppercase text-foreground"
      style={{
        ["--ui-delay" as string]: "0.5s",
        ["--target-opacity" as string]: "0.6",
        fontSize: "clamp(0.7rem, 0.85vw, 0.8125rem)",
        letterSpacing: "0.18em",
      }}
    >
      Real-time WebGL experience
    </div>
  );
}

export function HudCorner() {
  return (
    <div
      className="ui-fade pointer-events-none absolute right-6 top-6 md:right-10 md:top-10 font-mono uppercase text-foreground text-right"
      style={{
        ["--ui-delay" as string]: "0.5s",
        ["--target-opacity" as string]: "0.55",
        fontSize: "clamp(0.7rem, 0.85vw, 0.8125rem)",
        letterSpacing: "0.18em",
      }}
    >
      <div>Sector 07</div>
      <div className="opacity-60">N 40°43′ · W 74°00′</div>
    </div>
  );
}

interface PerfProps {
  fps: number;
  ms: number;
  draws: number;
}
export function PerfMonitor({ fps, ms, draws }: PerfProps) {
  return (
    <div
      className="ui-fade pointer-events-none absolute right-6 bottom-6 md:right-10 md:bottom-10 font-mono text-foreground/70 tabular-nums text-right leading-[1.5]"
      style={{
        ["--ui-delay" as string]: "1.8s",
        ["--target-opacity" as string]: "0.7",
        fontSize: "11px",
        letterSpacing: "0.06em",
      }}
    >
      <div>FPS&nbsp;&nbsp;{String(fps).padStart(3, " ")}</div>
      <div>GPU&nbsp;&nbsp;{ms.toFixed(1)}ms</div>
      <div>DRAW&nbsp;{String(draws).padStart(3, " ")}</div>
    </div>
  );
}

const PHASES = [
  { t: 0.0, label: "06:12 · Day" },
  { t: 0.35, label: "16:48 · Afternoon" },
  { t: 0.55, label: "19:24 · Sunset" },
  { t: 0.78, label: "21:10 · Dusk" },
  { t: 1.0, label: "23:47 · Night" },
];

export function HudClock({ progress }: { progress: number }) {
  // pick closest phase
  let label = PHASES[0].label;
  for (const p of PHASES) if (progress >= p.t - 0.001) label = p.label;
  return (
    <div
      className="ui-fade pointer-events-none absolute left-6 bottom-6 md:left-10 md:bottom-10 font-mono uppercase text-foreground tabular-nums"
      style={{
        ["--ui-delay" as string]: "1.8s",
        ["--target-opacity" as string]: "0.7",
        fontSize: "11px",
        letterSpacing: "0.16em",
      }}
    >
      <div className="opacity-60 mb-2">// time index</div>
      <div>{label}</div>
      <div className="mt-2 h-px w-40 bg-foreground/20 overflow-hidden">
        <div
          className="h-full bg-foreground/80 origin-left"
          style={{ transform: `scaleX(${progress})`, transition: "transform 120ms linear" }}
        />
      </div>
    </div>
  );
}

export function HudHint({ visible }: { visible: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 2400);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-10 md:bottom-14 text-foreground/60 font-mono uppercase transition-opacity duration-700"
      style={{
        opacity: show && visible ? 0.7 : 0,
        fontSize: "11px",
        letterSpacing: "0.22em",
      }}
    >
      ↓ &nbsp;Scroll&nbsp; ↓
    </div>
  );
}
