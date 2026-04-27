import type { ReactNode } from "react";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";

type Props = {
  children: ReactNode;
  /**
   * Eyebrow line shown above page title (e.g. "§02 — Live Traffic")
   */
  eyebrow?: string;
  title: ReactNode;
  /** subtitle paragraph */
  lede?: ReactNode;
  /** Optional right-side hero content (sits beside title on desktop) */
  aside?: ReactNode;
};

/**
 * Standard page chrome: nav + hero header + footer.
 * Section content goes inside `children`.
 */
export function PageShell({ children, eyebrow, title, lede, aside }: Props) {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <SiteNav />

      {/* Ambient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(80% 50% at 20% 0%, oklch(0.22 0.12 280 / 0.55), transparent 60%), radial-gradient(70% 50% at 100% 10%, oklch(0.2 0.1 230 / 0.45), transparent 60%), linear-gradient(180deg, oklch(0.06 0.025 265), oklch(0.045 0.02 265))",
        }}
      />

      <header className="px-5 pt-32 pb-12 md:px-8 md:pt-40 md:pb-20">
        <div className="mx-auto max-w-[1200px]">
          <div className="grid gap-10 md:grid-cols-[1.4fr_1fr] md:items-end">
            <div>
              {eyebrow && (
                <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-foreground/50">
                  {eyebrow}
                </p>
              )}
              <h1 className="mt-3 font-display text-balance text-5xl leading-[1.02] tracking-tight md:text-7xl">
                {title}
              </h1>
              {lede && (
                <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-foreground/65 md:text-lg">
                  {lede}
                </p>
              )}
            </div>
            {aside && <div className="md:justify-self-end">{aside}</div>}
          </div>
        </div>
      </header>

      <main className="relative px-5 md:px-8">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>

      <div className="mt-24 md:mt-32">
        <SiteFooter />
      </div>
    </div>
  );
}

export default PageShell;
