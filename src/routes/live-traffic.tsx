import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import PageShell from "@/components/PageShell";
import Reveal from "@/components/Reveal";
import TrafficCanvas from "@/components/TrafficCanvas";
import { Activity, AlertTriangle, Wind, Gauge } from "lucide-react";

export const Route = createFileRoute("/live-traffic")({
  head: () => ({
    meta: [
      { title: "Live Traffic — Urbanmesh" },
      {
        name: "description",
        content:
          "Real-time animated city traffic with adjustable density, incidents and intersection flow.",
      },
      { property: "og:title", content: "Live Traffic — Urbanmesh" },
      {
        property: "og:description",
        content:
          "An interactive top-down view of moving city traffic with live density and incident overlays.",
      },
    ],
  }),
  component: LiveTrafficPage,
});

const incidents = [
  { area: "Northwest Aspect", note: "Bus 42 dwell +90s at Brinkley & Pier", color: "from-amber-300 to-amber-500" },
  { area: "Canyon Streets", note: "Construction lane closure (E-bound)", color: "from-rose-300 to-rose-500" },
  { area: "Elevated Viaduct", note: "Density rising — 71% capacity", color: "from-sky-300 to-sky-500" },
];

function LiveTrafficPage() {
  const [density, setDensity] = useState(0.65);

  return (
    <PageShell
      eyebrow="§02 — Live Traffic"
      title={
        <>
          The street, <span className="text-gradient">breathing.</span>
        </>
      }
      lede="A continuous top-down telemetry feed. Tune density and watch the network re-balance itself in real time. Incidents surface as soft pulses; nothing screams unless it has to."
    >
      {/* Canvas */}
      <Reveal>
        <div className="relative overflow-hidden rounded-2xl border border-white/10 glow-ring">
          <TrafficCanvas density={density} className="block h-[420px] w-full md:h-[560px]" />
          <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/5" />
          {/* Top HUD */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-4 py-3 md:px-5 md:py-4">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-foreground/70">
              <span className="mr-2 inline-block h-1.5 w-1.5 translate-y-[-1px] rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
              Live · 1Hz · 612km
            </div>
            <div className="font-mono text-[10.5px] tabular-nums text-foreground/70">
              {Math.round(40 + density * 80)} units in view
            </div>
          </div>
          {/* Bottom controls */}
          <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col items-stretch gap-3 border-t border-white/10 bg-background/40 px-4 py-3 backdrop-blur-md md:flex-row md:items-center md:px-5">
            <div className="flex items-center gap-2 text-[12px] text-foreground/75">
              <Gauge className="h-3.5 w-3.5" />
              Density
            </div>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.01}
              value={density}
              onChange={(e) => setDensity(parseFloat(e.target.value))}
              className="h-1 w-full appearance-none rounded-full bg-white/10 outline-none accent-[var(--neon-violet)] md:flex-1"
              aria-label="Traffic density"
            />
            <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums text-foreground/70">
              <span>{Math.round(density * 100)}%</span>
              <span className="hidden md:inline text-foreground/40">|</span>
              <span className="hidden md:inline">avg {(28 + density * 18).toFixed(1)} km/h</span>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Stats + incidents */}
      <section className="mt-12 grid gap-6 md:grid-cols-3">
        {[
          { label: "Active vehicles", v: Math.round(40 + density * 80).toLocaleString(), sub: "in 12-block view", icon: <Activity className="h-3.5 w-3.5" /> },
          { label: "Avg speed", v: `${(28 + density * 18).toFixed(0)} km/h`, sub: "↓ 4% vs Tue", icon: <Wind className="h-3.5 w-3.5" /> },
          { label: "Open incidents", v: incidents.length.toString(), sub: "auto-cleared in ~9 min", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
        ].map((s, i) => (
          <Reveal key={s.label} delay={i * 80}>
            <div className="glass rounded-2xl p-6">
              <p className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.28em] text-foreground/55">
                {s.icon}
                {s.label}
              </p>
              <p className="mt-2 font-display text-4xl tabular-nums tracking-tight">{s.v}</p>
              <p className="mt-1.5 text-xs text-foreground/55">{s.sub}</p>
            </div>
          </Reveal>
        ))}
      </section>

      <section className="mt-12">
        <Reveal>
          <h2 className="font-display text-3xl tracking-tight md:text-4xl">Active incidents</h2>
        </Reveal>
        <ul className="mt-6 grid gap-3">
          {incidents.map((it, i) => (
            <Reveal key={it.area} delay={i * 80}>
              <li className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.06] md:p-5">
                <span
                  className={`inline-block h-9 w-1 rounded-full bg-gradient-to-b ${it.color}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-foreground/55">{it.area}</p>
                  <p className="mt-0.5 truncate text-sm text-foreground/85">{it.note}</p>
                </div>
                <span className="font-mono text-[11px] tabular-nums text-foreground/55">
                  {String(Math.floor(Math.random() * 10) + 1)}m ago
                </span>
              </li>
            </Reveal>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
