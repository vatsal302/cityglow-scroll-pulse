import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-background/70 backdrop-blur-md">
      <div className="mx-auto max-w-[1400px] px-5 py-12 md:px-8 md:py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-[var(--neon-violet)] to-[var(--energy)] text-[11px] font-bold tracking-widest text-background">
                UM
              </span>
              <span className="font-display text-lg">Urbanmesh</span>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-foreground/60">
              A smart urban mobility platform — live traffic, multi-modal routing
              and an AI 3D generator that turns photographs into navigable city assets.
            </p>
          </div>

          <FooterCol
            title="Product"
            links={[
              { to: "/live-traffic", label: "Live Traffic" },
              { to: "/routes-planner", label: "Routes Planner" },
              { to: "/public-transport", label: "Public Transport" },
            ]}
          />
          <FooterCol
            title="Company"
            links={[
              { to: "/", label: "Overview" },
            ]}
          />
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-foreground/50">
              Status
            </p>
            <p className="font-mono text-xs text-foreground/70">
              <span className="mr-2 inline-block h-1.5 w-1.5 translate-y-[-1px] rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
              All systems nominal
            </p>
            <p className="font-mono text-xs text-foreground/40">v0.4.2 · 2026</p>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-xs text-foreground/50 md:flex-row md:items-center">
          <p>© 2026 Urbanmesh Mobility Lab. Crafted for cities in motion.</p>
          <p className="font-mono tracking-tight">42.36° N · 71.05° W</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { to: "/" | "/live-traffic" | "/routes-planner" | "/public-transport"; label: string }[];
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-foreground/50">
        {title}
      </p>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.to}>
            <Link
              to={l.to}
              className="text-sm text-foreground/75 transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default SiteFooter;
