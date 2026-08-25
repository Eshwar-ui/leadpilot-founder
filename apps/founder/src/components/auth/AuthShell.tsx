import { Sparkles } from "lucide-react";

export function AuthShell({
  headline,
  description,
  badges,
  children,
}: {
  headline: React.ReactNode;
  description: string;
  badges: { label: string; tone: "emerald" | "amber" | "blue" | "violet" }[];
  children: React.ReactNode;
}) {
  const dotTone: Record<string, string> = {
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
    blue: "bg-blue-400",
    violet: "bg-violet-400",
  };

  return (
    <div className="flex min-h-screen w-full">
      <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-navy-950 px-12 py-12 lg:flex">
        {/* Ambient warmth — two soft gold washes anchored to opposite corners,
            so the panel reads as lit rather than flat black. */}
        <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 size-80 rounded-full bg-amber-600/[0.06] blur-3xl" />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/asan-mark.png" alt="" className="h-8 w-auto shrink-0" />
            <span className="text-base font-bold text-white">LeadPilot</span>
          </div>
          <span className="rounded-full border border-amber-400/20 bg-amber-400/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300/90">
            Founder Portal
          </span>
        </div>

        <div className="relative">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white">{headline}</h1>
          <p className="mt-3 max-w-sm text-sm text-slate-400">{description}</p>

          {/* Signal-lock motif: the same corner-bracket language as the LeadPilot
              mark, framing a pulsing signal instead of a wordmark — the visual
              argument for "every lead, located and ranked" instead of a random
              geometric filler illustration. */}
          <div className="relative mt-8 flex h-64 items-center justify-center overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-navy-900 via-navy-950 to-navy-950">
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(245,158,11,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.5) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
              }}
            />

            <div className="absolute size-40 rounded-full bg-amber-500/10 blur-2xl" />
            <div className="absolute size-40 rounded-full border border-amber-400/25 [animation:ping_2.8s_cubic-bezier(0,0,0.2,1)_infinite]" />
            <div className="absolute size-28 rounded-full border border-amber-400/20" />

            <svg viewBox="0 0 160 160" className="relative size-28 text-amber-400" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M8 42 V12 H38" />
              <path d="M122 12 H152 V42" />
              <path d="M152 118 V148 H122" />
              <path d="M38 148 H8 V118" />
            </svg>
            <span className="absolute size-2.5 rounded-full bg-amber-400 shadow-[0_0_18px_4px_rgba(245,158,11,0.55)]" />

            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
              {badges.map((b) => (
                <span
                  key={b.label}
                  className="inline-flex w-fit items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white backdrop-blur-sm"
                >
                  <span className={`size-1.5 rounded-full ${dotTone[b.tone]}`} />
                  {b.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* This slot used to claim "Trusted by the world's best sales teams" and
            "Join 5,000+ creators building the future" — invented social proof
            for a product with no public customer count, and "creators" is the
            wrong noun for a telecalling team. Replaced with something true. */}
        <div className="relative">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-400">
            <Sparkles className="size-3.5" />
            Every call scored, every lead ranked
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Recordings are transcribed and scored automatically, so your pipeline reflects what was
            actually said on the call.
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
