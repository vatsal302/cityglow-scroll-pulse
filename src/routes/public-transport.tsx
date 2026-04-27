import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import PageShell from "@/components/PageShell";
import Reveal from "@/components/Reveal";
import { Bus, Train, Tram } from "lucide-react";

export const Route = createFileRoute("/public-transport")({
  head: () => ({
    meta: [
      { title: "Public Transport — Urbanmesh" },
      {
        name: "description",
        content: "Live transit lines, departures and occupancy across the Urbanmesh network.",
      },
      { property: "og:title", content: "Public Transport — Urbanmesh" },
      {
        property: "og:description",
        content: "A timetable that argues less and answers faster.",
      },
    ],
  }),
  component: PublicTransport,
});

type Line = {
  id: string;
  name: string;
  type: "metro" | "tram" | "bus";
  color: string;
  next: string[]; // minutes-from-now strings
  occupancy: number; // 0..1
  stops: { name: string; key: string }[];
};

const lines: Line[] = [
  {
    id: "M1",
    name: "Riverline Express",
    type: "metro",
    color: "oklch(0.78 0.2 265)",
    next: ["2", "9", "16"],
    occupancy: 0.78,
    stops: [
      { name: "Pier 7", key: "pier" },
      { name: "Old Custom House", key: "custom" },
      { name: "Northwest Aspect", key: "nwa" },
      { name: "Brinkley Yards", key: "brinkley" },
      { name: "Canyon Streets", key: "canyon" },
      { name: "Highview Terminal", key: "highview" },
    ],
  },
  {
    id: "T4",
    name: "Greenway Tram",
    type: "tram",
    color: "oklch(0.74 0.24 305)",
    next: ["4", "12", "20"],
    occupancy: 0.42,
    stops: [
      { name: "Foundry Park", key: "foundry" },
      { name: "Lambert Square", key: "lambert" },
      { name: "Old Customs", key: "custom" },
      { name: "Brinkley & Pier", key: "brinkpier" },
      { name: "Riverline Hub", key: "river" },
    ],
  },
  {
    id: "B42",
    name: "Crosstown 42",
    type: "bus",
    color: "oklch(0.86 0.16 200)",
    next: ["1", "7", "14"],
    occupancy: 0.61,
    stops: [
      { name: "West Gate", key: "west" },
      { name: "Brinkley Plaza", key: "brink" },
      { name: "Canyon Streets", key: "canyon" },
      { name: "Elevated Viaduct", key: "viaduct" },
      { name: "Pier 7", key: "pier" },
      { name: "Mariner's End", key: "mariner" },
    ],
  },
];

function PublicTransport() {
  const [activeId, setActiveId] = useState<string>(lines[0].id);
  const active = useMemo(() => lines.find((l) => l.id === activeId)!, [activeId]);

  return (
    <PageShell
      eyebrow="§04 — Public Transport"
      title={
        <>
          The whole network, <span className="text-gradient">at a glance.</span>
        </>
      }
      lede="Lines, departures and live occupancy. Pick a line — the timeline reorganises around it."
    >
      <div className="grid gap-6 md:grid-cols-[340px_1fr]">
        {/* Line list */}
        <div className="space-y-3">
          {lines.map((l, i) => (
            <Reveal key={l.id} delay={i * 80}>
              <button
                type="button"
                onClick={() => setActiveId(l.id)}
                className={`group relative w-full overflow-hidden rounded-2xl border p-5 text-left transition-all active:scale-[0.99] ${
                  activeId === l.id
                    ? "border-white/20 bg-white/[0.06]"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                }`}
              >
                <span
                  className="absolute inset-y-0 left-0 w-1"
                  style={{ background: l.color, boxShadow: `0 0 18px ${l.color}` }}
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-bold tracking-wider text-background"
                      style={{ background: l.color }}
                    >
                      {l.id}
                    </span>
                    <div>
                      <p className="text-[15px] font-medium text-foreground">{l.name}</p>
                      <p className="flex items-center gap-1 text-xs capitalize text-foreground/55">
                        {l.type === "metro" && <Train className="h-3 w-3" />}
                        {l.type === "tram" && <Tram className="h-3 w-3" />}
                        {l.type === "bus" && <Bus className="h-3 w-3" />}
                        {l.type}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-foreground/55">
                      Next
                    </p>
                    <p className="font-display text-xl tabular-nums tracking-tight">{l.next[0]}m</p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.22em] text-foreground/55">
                    <span>Occupancy</span>
                    <span className="tabular-nums text-foreground/75">{Math.round(l.occupancy * 100)}%</span>
                  </div>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full transition-[width] duration-700"
                      style={{
                        width: `${l.occupancy * 100}%`,
                        background: l.color,
                      }}
                    />
                  </div>
                </div>
              </button>
            </Reveal>
          ))}
        </div>

        {/* Detail */}
        <Reveal delay={120}>
          <div className="glass-strong rounded-2xl p-6 md:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-foreground/55">
                  Line {active.id}
                </p>
                <h2 className="mt-1 font-display text-3xl tracking-tight md:text-4xl">{active.name}</h2>
              </div>
              <div className="flex items-center gap-2">
                {active.next.map((n, i) => (
                  <span
                    key={i}
                    className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium tabular-nums ${
                      i === 0
                        ? "bg-foreground text-background"
                        : "border border-white/10 bg-white/[0.04] text-foreground/75"
                    }`}
                  >
                    {n} min
                  </span>
                ))}
              </div>
            </div>

            {/* Route timeline */}
            <div className="mt-10 relative">
              <div
                className="absolute left-[10px] top-1 bottom-1 w-px"
                style={{
                  background: `linear-gradient(180deg, ${active.color}, transparent)`,
                  boxShadow: `0 0 14px ${active.color}`,
                }}
              />
              <ul className="space-y-5">
                {active.stops.map((s, i) => {
                  const eta = i * 3 + 1;
                  return (
                    <Reveal key={s.key} delay={i * 60}>
                      <li className="flex items-center gap-4 pl-0">
                        <span
                          className="relative z-10 inline-flex h-5 w-5 items-center justify-center rounded-full border-2"
                          style={{
                            borderColor: active.color,
                            background: i === 0 ? active.color : "var(--background)",
                          }}
                        />
                        <div className="flex flex-1 items-baseline justify-between gap-3">
                          <p className="text-[15px] text-foreground/90">{s.name}</p>
                          <p className="font-mono text-xs tabular-nums text-foreground/55">
                            +{eta}m
                          </p>
                        </div>
                      </li>
                    </Reveal>
                  );
                })}
              </ul>
            </div>

            {/* Schedule grid */}
            <div className="mt-10">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-foreground/55">
                Today's pattern
              </p>
              <div className="mt-3 grid grid-cols-6 gap-1.5 sm:grid-cols-12">
                {Array.from({ length: 24 }).map((_, h) => {
                  const intensity =
                    h < 5 ? 0.1 : h < 9 ? 0.95 : h < 16 ? 0.55 : h < 19 ? 0.9 : h < 23 ? 0.5 : 0.15;
                  return (
                    <div key={h} className="flex flex-col items-center gap-1">
                      <div
                        className="h-12 w-full rounded-md"
                        style={{
                          background: `linear-gradient(180deg, ${active.color}cc 0%, transparent 100%)`,
                          opacity: 0.25 + intensity * 0.75,
                        }}
                      />
                      <span className="font-mono text-[9.5px] tabular-nums text-foreground/45">
                        {h.toString().padStart(2, "0")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </PageShell>
  );
}
