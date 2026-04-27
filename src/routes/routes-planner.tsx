import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import PageShell from "@/components/PageShell";
import Reveal from "@/components/Reveal";
import { ArrowRight, Bike, Bus, Car, Footprints, Zap } from "lucide-react";

const CITIES = [
  "Northwest Aspect Plaza",
  "Canyon Streets Tower",
  "Neon Harbor Transit Hub",
  "Central Atrium",
  "Lower Viaduct",
  "Riverline Express",
  "Greenway Lane",
  "Pier 7",
  "Old Town Junction",
  "Skyway Terminus"
];

export const Route = createFileRoute("/routes-planner")({
  head: () => ({
    meta: [
      { title: "Routes Planner — Urbanmesh" },
      {
        name: "description",
        content:
          "Plan multi-modal routes between any two points. ETA, distance, energy and live alternates.",
      },
      { property: "og:title", content: "Routes Planner — Urbanmesh" },
      {
        property: "og:description",
        content: "Type two points. Watch the network solve.",
      },
    ],
  }),
  component: RoutesPlanner,
});

type Mode = "car" | "transit" | "bike" | "walk";
const modes: { id: Mode; label: string; icon: React.ReactNode }[] = [
  { id: "car", label: "Car", icon: <Car className="h-3.5 w-3.5" /> },
  { id: "transit", label: "Transit", icon: <Bus className="h-3.5 w-3.5" /> },
  { id: "bike", label: "Bike", icon: <Bike className="h-3.5 w-3.5" /> },
  { id: "walk", label: "Walk", icon: <Footprints className="h-3.5 w-3.5" /> },
];

// Pseudo-random but deterministic per (from,to,mode)
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function RoutesPlanner() {
  const [from, setFrom] = useState("Northwest Aspect Plaza");
  const [to, setTo] = useState("Canyon Streets Tower");
  const [mode, setMode] = useState<Mode>("car");
  const [submittedAt, setSubmittedAt] = useState<number>(Date.now());

  const result = useMemo(() => {
    const seed = hash(`${from}|${to}|${mode}|${submittedAt}`);
    const baseKm = 3 + (seed % 100) / 10; // 3..13 km
    const speeds: Record<Mode, number> = { car: 32, transit: 24, bike: 18, walk: 5 };
    const minutes = Math.round((baseKm / speeds[mode]) * 60);
    const energy = mode === "walk" ? 0 : mode === "bike" ? baseKm * 0.05 : mode === "transit" ? baseKm * 0.12 : baseKm * 0.21;
    return {
      km: baseKm.toFixed(1),
      minutes,
      energy: energy.toFixed(2),
      arrival: new Date(Date.now() + minutes * 60_000),
    };
  }, [from, to, mode, submittedAt]);

  // Generate a smooth polyline path on a square viewport
  const path = useMemo(() => {
    const seed = hash(`${from}|${to}`);
    const rand = (n: number) => ((seed >> (n * 3)) % 100) / 100;
    const ctrl1 = { x: 80 + rand(0) * 120, y: 90 + rand(1) * 100 };
    const ctrl2 = { x: 220 + rand(2) * 120, y: 220 + rand(3) * 100 };
    return { ctrl1, ctrl2 };
  }, [from, to]);

  return (
    <PageShell
      eyebrow="§03 — Routes Planner"
      title={
        <>
          Two points. <span className="text-gradient">One stroke.</span>
        </>
      }
      lede="Multi-modal pathfinding across road, rail, lane and footpath. ETA, distance and energy use, all composed in a single readable diagram."
    >
      <div className="grid gap-8 md:grid-cols-[1fr_1.4fr]">
        {/* Form */}
        <Reveal>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmittedAt(Date.now());
            }}
            className="glass-strong sticky top-24 rounded-2xl p-6 md:p-7"
          >
            <div className="space-y-4">
              <Field
                label="From"
                value={from}
                onChange={setFrom}
                placeholder="Origin"
                dot="bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.85)]"
              />
              <Field
                label="To"
                value={to}
                onChange={setTo}
                placeholder="Destination"
                dot="bg-fuchsia-400 shadow-[0_0_10px_rgba(232,121,249,0.85)]"
              />
            </div>

            <div className="mt-5">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-foreground/55">
                Mode
              </p>
              <div className="mt-2 grid grid-cols-4 gap-1.5 rounded-full border border-white/10 bg-white/[0.04] p-1">
                {modes.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`relative flex items-center justify-center gap-1.5 rounded-full px-2 py-2 text-[12px] font-medium transition-colors active:scale-[0.97] ${
                      mode === m.id
                        ? "bg-foreground text-background"
                        : "text-foreground/65 hover:text-foreground"
                    }`}
                  >
                    {m.icon}
                    <span className="hidden sm:inline">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-[var(--neon-violet)] to-[var(--energy)] px-5 py-3 text-sm font-medium text-background transition-transform hover:-translate-y-px active:scale-[0.97]"
            >
              Solve route
              <ArrowRight className="h-4 w-4" />
            </button>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <Stat label="Distance" v={`${result.km} km`} />
              <Stat label="ETA" v={`${result.minutes} min`} />
              <Stat
                label="Energy"
                v={
                  <span className="inline-flex items-center gap-0.5">
                    <Zap className="h-3 w-3 text-amber-300" />
                    {result.energy}
                  </span>
                }
              />
            </div>
          </form>
        </Reveal>

        {/* Map */}
        <Reveal delay={120}>
          <div className="relative overflow-hidden rounded-2xl border border-white/10 glow-ring">
            <svg
              viewBox="0 0 480 420"
              className="block h-[420px] w-full bg-[radial-gradient(ellipse_at_top,oklch(0.18_0.08_265),oklch(0.07_0.03_265))] md:h-[560px]"
            >
              {/* Grid */}
              <defs>
                <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
                  <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.6" />
                </pattern>
                <linearGradient id="route" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="oklch(0.86 0.16 200)" />
                  <stop offset="50%" stopColor="oklch(0.78 0.2 265)" />
                  <stop offset="100%" stopColor="oklch(0.74 0.24 305)" />
                </linearGradient>
                <filter id="routeGlow">
                  <feGaussianBlur stdDeviation="3" />
                </filter>
              </defs>
              <rect width="480" height="420" fill="url(#grid)" />

              {/* Faint district blobs */}
              <ellipse cx="120" cy="120" rx="80" ry="60" fill="oklch(0.7 0.18 240 / 0.06)" />
              <ellipse cx="360" cy="280" rx="100" ry="70" fill="oklch(0.78 0.22 305 / 0.08)" />

              {/* Route — glow */}
              <path
                d={`M 60 340 C ${path.ctrl1.x} ${path.ctrl1.y}, ${path.ctrl2.x} ${path.ctrl2.y}, 420 70`}
                stroke="url(#route)"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                opacity="0.45"
                filter="url(#routeGlow)"
              />
              {/* Route — line */}
              <path
                key={submittedAt}
                d={`M 60 340 C ${path.ctrl1.x} ${path.ctrl1.y}, ${path.ctrl2.x} ${path.ctrl2.y}, 420 70`}
                stroke="url(#route)"
                strokeWidth="2.4"
                fill="none"
                strokeLinecap="round"
                strokeDasharray="900"
                strokeDashoffset="900"
                style={{
                  animation: "route-draw 1.6s cubic-bezier(0.16,1,0.3,1) forwards",
                }}
              />

              {/* Origin */}
              <g transform="translate(60 340)">
                <circle r="12" fill="oklch(0.6 0.2 150 / 0.18)" />
                <circle r="5" fill="oklch(0.78 0.18 150)" />
                <text x="14" y="4" fontSize="10" fill="rgba(255,255,255,0.7)" fontFamily="IBM Plex Mono">
                  A
                </text>
              </g>
              {/* Destination */}
              <g transform="translate(420 70)">
                <circle r="12" fill="oklch(0.78 0.22 305 / 0.18)" />
                <circle r="5" fill="oklch(0.78 0.22 305)" />
                <text x="-22" y="4" fontSize="10" fill="rgba(255,255,255,0.7)" fontFamily="IBM Plex Mono">
                  B
                </text>
              </g>

              <style>{`
                @keyframes route-draw {
                  to { stroke-dashoffset: 0; }
                }
              `}</style>
            </svg>

            {/* Overlay summary */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 border-t border-white/10 bg-background/45 px-5 py-4 backdrop-blur-md">
              <div>
                <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-foreground/55">
                  Arrival
                </p>
                <p className="font-display text-2xl tabular-nums tracking-tight">
                  {result.arrival.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-foreground/55">
                  Mode
                </p>
                <p className="font-display text-2xl tracking-tight capitalize">{mode}</p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      {/* Alternates */}
      <section className="mt-14">
        <Reveal>
          <h2 className="font-display text-3xl tracking-tight md:text-4xl">Alternates</h2>
        </Reveal>
        <ul className="mt-6 grid gap-3 md:grid-cols-3">
          {[
            { name: "Lower Viaduct", delta: "+3 min", note: "Avoids bridge dwell", color: "from-sky-300 to-sky-500" },
            { name: "Riverline Express", delta: "+6 min", note: "Transfers at Pier 7", color: "from-fuchsia-300 to-fuchsia-500" },
            { name: "Greenway Lane", delta: "+11 min", note: "Bike-friendly, no hills", color: "from-emerald-300 to-emerald-500" },
          ].map((a, i) => (
            <Reveal key={a.name} delay={i * 80}>
              <button
                type="button"
                className="group w-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left transition-colors hover:bg-white/[0.06] active:scale-[0.99]"
              >
                <span className={`inline-block h-1 w-10 rounded-full bg-gradient-to-r ${a.color}`} />
                <p className="mt-3 font-display text-xl tracking-tight">{a.name}</p>
                <p className="mt-1 text-sm text-foreground/60">{a.note}</p>
                <p className="mt-3 font-mono text-xs text-foreground/55">ETA {a.delta}</p>
              </button>
            </Reveal>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  dot,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  dot?: string;
}) {
  const [open, setOpen] = useState(false);
  const filtered = CITIES.filter(c => c.toLowerCase().includes(value.toLowerCase()) && c !== value);

  return (
    <label className="block relative">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-foreground/55">
        {label}
      </span>
      <span className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 transition-colors focus-within:border-white/20 focus-within:bg-white/[0.06]">
        <span className={`h-2 w-2 rounded-full ${dot ?? "bg-foreground/60"}`} />
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-foreground placeholder:text-foreground/30 focus:outline-none"
          maxLength={120}
        />
      </span>
      {open && filtered.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-xl border border-white/10 bg-[#0a0d1f]/95 p-1 shadow-xl backdrop-blur-md">
          {filtered.map(c => (
            <li key={c}>
              <button
                type="button"
                className="w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-white/10"
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
              >
                {c}
              </button>
            </li>
          ))}
        </ul>
      )}
    </label>
  );
}

function Stat({ label, v }: { label: string; v: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="font-mono text-[9.5px] uppercase tracking-[0.24em] text-foreground/50">{label}</p>
      <p className="mt-1 font-display text-lg tabular-nums tracking-tight">{v}</p>
    </div>
  );
}
