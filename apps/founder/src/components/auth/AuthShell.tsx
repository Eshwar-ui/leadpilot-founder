import { Sparkles } from "lucide-react";
import { AsanLogo } from "@/components/AsanLogo";
import { SignalLockPanel } from "@/components/auth/SignalLockPanel";

export function AuthShell({
  headline,
  description,
  badges,
  children,
}: {
  headline: React.ReactNode;
  description: string;
  badges: { label: string; tone: "emerald" | "gold" | "blue" | "violet" }[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full">
      <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden bg-navy-950 px-12 py-12 lg:flex">
        {/* Ambient warmth — two soft gold washes anchored to opposite corners,
            so the panel reads as lit rather than flat black. */}
        <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-gold-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 size-80 rounded-full bg-gold-600/[0.06] blur-3xl" />

        <div className="relative flex items-center justify-between">
          <AsanLogo className="h-11 w-20" />
          <span className="rounded-full border border-gold-400/20 bg-gold-400/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-gold-300/90">
            Founder Portal
          </span>
        </div>

        <div className="relative">
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white">{headline}</h1>
          <p className="mt-3 max-w-sm text-sm text-slate-400">{description}</p>

          <SignalLockPanel height="h-64" ringSize="size-40" coreSize="size-28" badges={badges} />
        </div>

        {/* This slot used to claim "Trusted by the world's best sales teams" and
            "Join 5,000+ creators building the future" — invented social proof
            for a product with no public customer count, and "creators" is the
            wrong noun for a telecalling team. Replaced with something true. */}
        <div className="relative">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-gold-400">
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
