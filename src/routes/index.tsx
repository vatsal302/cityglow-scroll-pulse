import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import CityScene, { type CitySceneHandle } from "@/components/CityScene";
import {
  HudTitle,
  HudEyebrow,
  HudCorner,
  PerfMonitor,
  HudClock,
  HudHint,
} from "@/components/CityHud";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import Reveal from "@/components/Reveal";
import {
  ActivitySquare,
  Compass,
  Bus,
  Boxes,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Urbanmesh — Smart Urban Mobility & AI 3D Generator" },
      {
        name: "description",
        content:
          "Live traffic, multi-modal routing, public transport schedules and an AI-powered image-to-3D city generator. Conduct the city through scroll and cursor.",
      },
      { property: "og:title", content: "Urbanmesh — Smart Urban Mobility" },
      {
        property: "og:description",
        content:
          "An interactive smart-mobility platform with a real-time WebGL city and AI 3D generator.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const handleRef = useRef<CitySceneHandle | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ fps: 60, ms: 8.0, draws: 0 });
  const [heroDone, setHeroDone] = useState(false);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    function onScroll() {
      const max = scroller!.scrollHeight - window.innerHeight;
      const p = Math.min(1, Math.max(0, window.scrollY / Math.max(max, 1)));
      setProgress(p);
      handleRef.current?.setScroll(p);
      setHeroDone(window.scrollY > window.innerHeight * 0.85);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleClick(e: React.MouseEvent) {
    handleRef.current?.togglePower(e.clientX, e.clientY);
  }

  return (
    <div className="relative bg-background text-foreground">
      <SiteNav />

      {/* Sticky 3D viewport — cinematic hero */}
      <div
        className="fixed inset-0 z-0 transition-opacity duration-500"
        style={{ opacity: heroDone ? 0.18 : 1 }}
        onClick={handleClick}
      >
        <CityScene
          onReady={(h) => {
            handleRef.current = h;
          }}
          onStats={setStats}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 35%, transparent 55%, rgba(0,0,0,0.55) 100%)",
          }}
        />
        <HudEyebrow />
        <HudCorner />
        <HudTitle />
        <HudClock progress={progress} />
        <PerfMonitor fps={stats.fps} ms={stats.ms} draws={stats.draws} />
        <HudHint visible={progress < 0.05} />
      </div>

      {/* Scroll driver — invisible tall element */}
      <div ref={scrollerRef} className="relative z-10 pointer-events-none">
        <section style={{ height: "320vh" }} />
      </div>

      {/* Content sections (above the fixed scene) */}
      <div className="relative z-20 pointer-events-auto">
        {/* Capabilities */}
        <section className="relative bg-background/85 backdrop-blur-xl border-t border-white/10 px-5 py-24 md:px-8 md:py-32">
          <div className="mx-auto max-w-[1200px]">
            <Reveal>
              <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-foreground/50">
                §02 — Capabilities
              </p>
            </Reveal>
            <Reveal delay={80} className="mt-3 max-w-3xl">
              <h2 className="font-display text-balance text-4xl leading-[1.05] tracking-tight md:text-6xl">
                Four instruments. <span className="text-gradient">One city, in real time.</span>
              </h2>
            </Reveal>
            <Reveal delay={160} className="mt-5 max-w-2xl">
              <p className="text-pretty text-base leading-relaxed text-foreground/65 md:text-lg">
                Urbanmesh blends live traffic telemetry, multi-modal routing,
                transit timetables and an AI 3D generator into a single, calm
                operator's console.
              </p>
            </Reveal>

            <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 md:grid-cols-2">
              <CapabilityCard
                index="01"
                to="/live-traffic"
                title="Live Traffic"
                desc="Density, incidents and intersection flow rendered as a breathing canvas. No legacy gauges — only the road, moving."
                icon={<ActivitySquare className="h-4 w-4" />}
                accent="from-[var(--energy)]/30 to-transparent"
                delay={0}
              />
              <CapabilityCard
                index="02"
                to="/routes-planner"
                title="Routes Planner"
                desc="Type two points. Watch the network solve. ETA, distance, modes and energy cost — composed in one stroke."
                icon={<Compass className="h-4 w-4" />}
                accent="from-[var(--neon-cyan)]/30 to-transparent"
                delay={80}
              />
              <CapabilityCard
                index="03"
                to="/public-transport"
                title="Public Transport"
                desc="Lines, departures, occupancy. A timetable that argues less and answers faster."
                icon={<Bus className="h-4 w-4" />}
                accent="from-[var(--neon-violet)]/30 to-transparent"
                delay={160}
              />
              <CapabilityCard
                index="04"
                to="/3d-generator"
                title="3D Generator"
                desc="Drop a photograph of a building or vehicle. Receive a navigable, web-ready 3D asset in seconds. Powered by AI."
                icon={<Boxes className="h-4 w-4" />}
                accent="from-[var(--neon-magenta)]/30 to-transparent"
                delay={240}
                badge="AI"
              />
            </div>
          </div>
        </section>

        {/* Stats strip */}
        <section className="relative border-t border-white/10 bg-background/90 backdrop-blur-xl px-5 py-20 md:px-8">
          <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-10 md:grid-cols-4">
            {[
              { k: "Edges in graph", v: "1.84M", sub: "across 612 km of road" },
              { k: "Median ETA error", v: "47s", sub: "rolling 7-day window" },
              { k: "Transit lines indexed", v: "238", sub: "37 operators" },
              { k: "Models generated", v: "12,406", sub: "since launch" },
            ].map((s, i) => (
              <Reveal key={s.k} delay={i * 70}>
                <div>
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-foreground/45">
                    {s.k}
                  </p>
                  <p className="mt-2 font-display text-4xl tabular-nums tracking-tight text-foreground md:text-5xl">
                    {s.v}
                  </p>
                  <p className="mt-1.5 text-xs text-foreground/55">{s.sub}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="relative border-t border-white/10 bg-background/90 px-5 py-28 md:px-8 md:py-36">
          <div className="mx-auto max-w-[1100px] text-center">
            <Reveal>
              <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-foreground/50">
                <Sparkles className="mr-1.5 inline h-3 w-3 align-[-2px]" />
                3D Generator · Beta
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h2 className="mt-4 font-display text-balance text-5xl leading-[1.04] tracking-tight md:text-7xl">
                A photograph in.
                <br />
                <span className="text-gradient">A city block out.</span>
              </h2>
            </Reveal>
            <Reveal delay={180}>
              <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-foreground/65 md:text-lg">
                Upload an image. Our model reads façades, mass and material,
                then returns a clean low-poly mesh ready for the web.
              </p>
            </Reveal>
            <Reveal delay={260}>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                <Link
                  to="/3d-generator"
                  className="group inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-transform hover:-translate-y-px active:scale-[0.97]"
                >
                  Open the Generator
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:rotate-45" />
                </Link>
                <Link
                  to="/contact"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-medium text-foreground/85 transition-colors hover:bg-white/10 active:scale-[0.97]"
                >
                  Talk to the team
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        <SiteFooter />
      </div>
    </div>
  );
}

function CapabilityCard({
  index,
  title,
  desc,
  to,
  icon,
  accent,
  delay = 0,
  badge,
}: {
  index: string;
  title: string;
  desc: string;
  to: "/live-traffic" | "/routes-planner" | "/public-transport" | "/3d-generator";
  icon: React.ReactNode;
  accent: string;
  delay?: number;
  badge?: string;
}) {
  return (
    <Reveal delay={delay}>
      <Link
        to={to}
        preload="intent"
        className="group relative block h-full overflow-hidden bg-background p-8 transition-colors hover:bg-background/60 md:p-10"
      >
        <div
          className={`pointer-events-none absolute -top-1/2 -right-1/3 h-[160%] w-[80%] rounded-full bg-gradient-radial blur-[60px] opacity-0 transition-opacity duration-700 group-hover:opacity-100`}
          style={{
            background: `radial-gradient(closest-side, oklch(0.78 0.22 305 / 0.18), transparent 70%)`,
          }}
        />
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-foreground/45">
              {index}
            </span>
            <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br ${accent} text-foreground/90 ring-1 ring-white/10`}>
              {icon}
            </span>
          </div>
          {badge && (
            <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-foreground/70">
              {badge}
            </span>
          )}
        </div>

        <h3 className="mt-7 font-display text-3xl tracking-tight text-foreground md:text-4xl">
          {title}
        </h3>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-foreground/60">
          {desc}
        </p>

        <span className="mt-7 inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground/85">
          Enter
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </Link>
    </Reveal>
  );
}
