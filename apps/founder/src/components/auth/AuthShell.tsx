import { Sparkles } from "lucide-react";

export function AuthShell({
  headline,
  description,
  badges,
  children,
}: {
  headline: string;
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
      <div className="relative hidden w-[38%] flex-col justify-between overflow-hidden bg-navy-950 px-10 py-10 lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary-600 text-sm font-bold text-white">
            LP
          </span>
          <span className="text-base font-bold text-white">LeadPilot</span>
        </div>

        <div>
          <h1 className="text-3xl font-bold leading-tight text-white">{headline}</h1>
          <p className="mt-3 max-w-sm text-sm text-slate-400">{description}</p>

          <div className="relative mt-8 h-72 overflow-hidden rounded-2xl bg-gradient-to-br from-primary-900/40 via-navy-900 to-navy-900 p-6">
            <div className="absolute -right-6 top-8 size-24 rotate-12 rounded-2xl border border-white/10" />
            <div className="absolute left-8 top-16 size-32 rotate-45 rounded-2xl border border-white/10 bg-primary-500/10" />
            <div className="absolute right-10 bottom-16 size-16 rounded-full bg-primary-500/20 blur-xl" />
            <div className="absolute left-20 bottom-10 size-3 rounded-full bg-navy-800" />

            <div className="absolute bottom-6 left-6 flex flex-col gap-2">
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

        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-primary-400">
            <Sparkles className="size-3.5" />
            Trusted by the world&apos;s best sales teams
          </p>
          <p className="mt-1 text-xs text-slate-500">Join 5,000+ creators building the future.</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
