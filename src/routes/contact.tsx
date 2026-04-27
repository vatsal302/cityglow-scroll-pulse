import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import PageShell from "@/components/PageShell";
import Reveal from "@/components/Reveal";
import { Mail, Send, Building2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Urbanmesh" },
      {
        name: "description",
        content: "Get in touch with the Urbanmesh team about smart-mobility deployments and the AI 3D generator.",
      },
      { property: "og:title", content: "Contact — Urbanmesh" },
      {
        property: "og:description",
        content: "Talk to the team behind Urbanmesh.",
      },
    ],
  }),
  component: ContactPage,
});

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  organization: z.string().trim().max(160).optional(),
  message: z.string().trim().min(8, "Tell us a little more").max(2000),
});

function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", organization: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof form>(key: K, v: string) {
    setForm((f) => ({ ...f, [key]: v }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = schema.safeParse(form);
    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const k = issue.path[0] as string;
        if (k && !next[k]) next[k] = issue.message;
      }
      setErrors(next);
      return;
    }
    setSubmitting(true);
    // Simulate dispatch
    await new Promise((r) => setTimeout(r, 700));
    setSubmitting(false);
    setForm({ name: "", email: "", organization: "", message: "" });
    toast.success("Message received. We'll be in touch shortly.");
  }

  return (
    <PageShell
      eyebrow="§06 — Contact"
      title={
        <>
          Tell us about <span className="text-gradient">your city.</span>
        </>
      }
      lede="Pilots, integrations, datasets, research collaborations. We read every message."
    >
      <div className="grid gap-10 md:grid-cols-[1.4fr_1fr]">
        <Reveal>
          <form onSubmit={onSubmit} noValidate className="glass-strong rounded-2xl p-6 md:p-8">
            <div className="grid gap-5 md:grid-cols-2">
              <FormField
                label="Name"
                value={form.name}
                onChange={(v) => update("name", v)}
                placeholder="Your name"
                error={errors.name}
                required
              />
              <FormField
                label="Email"
                type="email"
                value={form.email}
                onChange={(v) => update("email", v)}
                placeholder="you@city.gov"
                error={errors.email}
                required
              />
            </div>
            <div className="mt-5">
              <FormField
                label="Organization"
                value={form.organization}
                onChange={(v) => update("organization", v)}
                placeholder="Department, lab or company (optional)"
                error={errors.organization}
              />
            </div>
            <div className="mt-5">
              <label className="block">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-foreground/55">
                  Message
                </span>
                <textarea
                  value={form.message}
                  onChange={(e) => update("message", e.target.value)}
                  rows={6}
                  maxLength={2000}
                  placeholder="What are you trying to solve?"
                  className="mt-1.5 block w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-foreground placeholder:text-foreground/30 focus:border-white/20 focus:bg-white/[0.06] focus:outline-none"
                />
                {errors.message && (
                  <span className="mt-1.5 block text-xs text-destructive">{errors.message}</span>
                )}
                <span className="mt-1.5 block font-mono text-[10.5px] tabular-nums text-foreground/45">
                  {form.message.length}/2000
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-[var(--neon-violet)] to-[var(--energy)] px-6 py-3 text-sm font-medium text-background transition-transform hover:-translate-y-px active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  Sending…
                </>
              ) : (
                <>
                  Send message
                  <Send className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </Reveal>

        <Reveal delay={140}>
          <aside className="space-y-4">
            <InfoCard
              icon={<Mail className="h-4 w-4" />}
              title="General inquiries"
              body="hello@urbanmesh.lab"
            />
            <InfoCard
              icon={<Building2 className="h-4 w-4" />}
              title="Cities & operators"
              body="Pilot programs and live data integrations. We work with planning departments and transit authorities."
            />
            <InfoCard
              icon={<MessageCircle className="h-4 w-4" />}
              title="Research partnerships"
              body="Open to collaborations on multi-modal routing, traffic modeling and 3D city reconstruction."
            />
          </aside>
        </Reveal>
      </div>
    </PageShell>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  error,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-foreground/55">
        {label}
        {required && <span className="ml-1 text-foreground/35">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 block w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-foreground placeholder:text-foreground/30 focus:border-white/20 focus:bg-white/[0.06] focus:outline-none"
        maxLength={255}
      />
      {error && <span className="mt-1.5 block text-xs text-destructive">{error}</span>}
    </label>
  );
}

function InfoCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--neon-violet)] to-[var(--energy)] text-background">
        {icon}
      </span>
      <p className="mt-3 text-[15px] font-medium text-foreground">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-foreground/65">{body}</p>
    </div>
  );
}
