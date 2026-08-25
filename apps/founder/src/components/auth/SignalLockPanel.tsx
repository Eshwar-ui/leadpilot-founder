const DOT_TONE: Record<string, string> = {
  emerald: "bg-emerald-400",
  gold: "bg-gold-400",
  blue: "bg-blue-400",
  violet: "bg-violet-400",
};

/**
 * The gold "signal-lock" hero visual shared by the login/register hero panel
 * (AuthShell) and the onboarding wizard's side panel — the same corner-bracket
 * language as the LeadPilot mark, framing a pulsing signal instead of a
 * wordmark or an unrelated decorative shape. `height`/`ringSize`/`coreSize`
 * let each caller fit it to its own panel without duplicating the markup.
 */
export function SignalLockPanel({
  height = "h-64",
  ringSize = "size-40",
  coreSize = "size-28",
  badges,
}: {
  height?: string;
  ringSize?: string;
  coreSize?: string;
  badges: { label: string; tone: "emerald" | "gold" | "blue" | "violet" }[];
}) {
  return (
    <div
      className={`relative mt-8 flex ${height} items-center justify-center overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-navy-900 via-navy-950 to-navy-950`}
    >
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(color-mix(in srgb, var(--color-gold-500) 50%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--color-gold-500) 50%, transparent) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className={`absolute ${ringSize} rounded-full bg-gold-500/10 blur-2xl`} />
      <div className={`absolute ${ringSize} rounded-full border border-gold-400/25 [animation:ping_2.8s_cubic-bezier(0,0,0.2,1)_infinite]`} />
      <div className={`absolute ${coreSize} rounded-full border border-gold-400/20`} />

      <svg viewBox="0 0 160 160" className={`relative ${coreSize} text-gold-400`} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <path d="M8 42 V12 H38" />
        <path d="M122 12 H152 V42" />
        <path d="M152 118 V148 H122" />
        <path d="M38 148 H8 V118" />
      </svg>
      <span className="absolute size-2.5 rounded-full bg-gold-400 shadow-[0_0_18px_4px_color-mix(in_srgb,var(--color-gold-500)_55%,transparent)]" />

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
        {badges.map((b) => (
          <span
            key={b.label}
            className="inline-flex w-fit items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white backdrop-blur-sm"
          >
            <span className={`size-1.5 rounded-full ${DOT_TONE[b.tone]}`} />
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}
