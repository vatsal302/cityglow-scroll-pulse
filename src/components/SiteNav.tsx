import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { to: "/" as const, label: "Home" },
  { to: "/live-traffic" as const, label: "Live Traffic" },
  { to: "/routes-planner" as const, label: "Routes Planner" },
  { to: "/public-transport" as const, label: "Public Transport" },
];

export function SiteNav() {
  const { location } = useRouterState();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[backdrop-filter,background-color,border-color] duration-300 ${
        scrolled || open
          ? "bg-background/60 backdrop-blur-xl border-b border-white/10"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-5 md:px-8">
        <Link to="/" className="group flex items-center gap-2.5">
          <span className="relative inline-flex h-7 w-7 items-center justify-center">
            <span className="absolute inset-0 rounded-md bg-gradient-to-br from-[var(--neon-violet)] to-[var(--energy)] opacity-90 blur-[6px] transition-opacity group-hover:opacity-100" />
            <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-[var(--neon-violet)] to-[var(--energy)] text-[11px] font-bold tracking-widest text-background">
              UM
            </span>
          </span>
          <span className="font-display text-[17px] tracking-tight text-foreground/95">
            Urbanmesh
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const active =
              l.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                preload="intent"
                className={`relative rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  active
                    ? "text-foreground"
                    : "text-foreground/60 hover:text-foreground"
                }`}
              >
                {active && (
                  <span className="absolute inset-0 rounded-full bg-white/8 ring-1 ring-white/10" />
                )}
                <span className="relative">{l.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen((s) => !s)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-foreground md:hidden active:scale-95 transition-transform"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`md:hidden overflow-hidden transition-[max-height,opacity] duration-300 ${
          open ? "max-h-[440px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <nav className="flex flex-col gap-0.5 border-t border-white/10 px-4 py-3">
          {links.map((l) => {
            const active =
              l.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`rounded-md px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-white/8 text-foreground"
                    : "text-foreground/70 hover:bg-white/5 hover:text-foreground"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export default SiteNav;
