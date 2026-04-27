import { createFileRoute } from "@tanstack/react-router";
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
    </div>
  );
}
