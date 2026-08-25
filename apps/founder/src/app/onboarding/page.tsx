"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Upload } from "lucide-react";
import { StepIndicator } from "@/components/onboarding/StepIndicator";
import { Button } from "@/components/ui/Button";
import { TagInput } from "@/components/ui/TagInput";
import { cn } from "@/lib/utils";
import { ApiError, orgApi } from "@/lib/api";

const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5MB, matches the dropzone's own copy

const STEP_META = [
  {
    headline: "Your AI-powered lead engine",
    description: "Set up your organisation in minutes and let LeadPilot's AI agents handle the rest.",
    badges: ["AI Agents Active", "Smart Lead Scoring"],
  },
  {
    headline: "Define what you sell",
    description: "Help our AI understand your services and pricing to generate better qualified leads for you.",
    badges: ["Auto Pricing Analysis", "Audience Targeting"],
  },
  {
    headline: "Your brand, your voice",
    description: "Tell us how your brand communicates. Our AI will mirror your voice when engaging with leads.",
    badges: ["Voice Personalisation", "Competitor Intelligence"],
  },
  {
    headline: "Almost there!",
    description: "Review your details and launch your AI-powered lead engine. Your agents will be ready instantly.",
    badges: ["AI Agents Ready", "Lead Pipeline Configured"],
  },
];

const LANGUAGE_OPTIONS = ["English", "Hindi", "Telugu", "Tamil", "Kannada"];
const VOICE_OPTIONS = [
  { key: "Premium", desc: "Professional, exclusive" },
  { key: "Friendly", desc: "Warm, approachable" },
  { key: "Authoritative", desc: "Expert, direct" },
  { key: "Casual", desc: "Relaxed, informal" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1 — start BLANK for a real new client. These are the org's own
  // details, not demo data; the draft-prefill effect below restores anything
  // already saved. Example hints live in each field's `placeholder`.
  const [orgName, setOrgName] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);

  // Step 2 — this is the Organisation Knowledge Base every AI feature (scoring
  // relevance, follow-up tone, script generation) reads from, so every field
  // here needs to actually persist, not just render. Blank by default.
  const [services, setServices] = useState<string[]>([]);
  const [pricingMin, setPricingMin] = useState("");
  const [pricingMax, setPricingMax] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [usps, setUsps] = useState<string[]>([]);

  // Step 3 — no brand voice pre-selected; the client picks one.
  const [brandVoice, setBrandVoice] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  // Draft prefill: without this, a mid-wizard refresh (before "Create
  // Organisation" is hit) silently loses every field the client already typed.
  // Runs once on mount; a brand-new org's all-null response leaves every field
  // blank (its initial state), so nothing is ever pre-populated for them.
  useEffect(() => {
    let cancelled = false;
    orgApi
      .get()
      .then((profile) => {
        if (cancelled) return;
        if (profile.name) setOrgName(profile.name);
        if (profile.industry) setIndustry(profile.industry);
        if (profile.website_url) setWebsite(profile.website_url);
        if (profile.languages?.length) setLanguages(profile.languages);
        if (profile.services?.length) setServices(profile.services);
        if (profile.pricing_min != null) setPricingMin(String(profile.pricing_min));
        if (profile.pricing_max != null) setPricingMax(String(profile.pricing_max));
        if (profile.target_audience) setTargetAudience(profile.target_audience);
        if (profile.usps?.length) setUsps(profile.usps);
        if (profile.brand_voice) setBrandVoice(profile.brand_voice);
        if (profile.competitors?.length) setCompetitors(profile.competitors);
        if (profile.logo_url) setLogoDataUrl(profile.logo_url);
      })
      .catch(() => {
        // No saved profile yet (or not logged in) — keep the placeholders.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const meta = STEP_META[step - 1];

  function handleLogoSelect(file: File | undefined) {
    setLogoError(null);
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      setLogoError("File is too large — max 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(reader.result as string);
    reader.onerror = () => setLogoError("Couldn't read that file — try another.");
    reader.readAsDataURL(file);
  }

  async function handleLaunch() {
    setLaunching(true);
    setLaunchError(null);
    try {
      await orgApi.update({
        name: orgName,
        industry,
        website_url: website,
        services,
        pricing_min: pricingMin ? Number(pricingMin) : undefined,
        pricing_max: pricingMax ? Number(pricingMax) : undefined,
        target_audience: targetAudience || undefined,
        competitors,
        brand_voice: brandVoice,
        languages,
        usps,
        logo_url: logoDataUrl ?? undefined,
      });
      router.push("/dashboard");
    } catch (e) {
      setLaunchError(e instanceof ApiError ? e.message : "Couldn't save your organisation profile. Please try again.");
    } finally {
      setLaunching(false);
    }
  }

  function toggleLanguage(lang: string) {
    setLanguages((prev) => (prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]));
  }

  return (
    <div className="flex min-h-screen w-full">
      <div className="relative hidden w-[32%] flex-col justify-between overflow-hidden bg-navy-950 px-10 py-10 lg:flex">
        {/* Ambient warmth — matches the login/register hero panel. */}
        <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 size-80 rounded-full bg-amber-600/[0.06] blur-3xl" />

        <div className="relative flex items-center gap-2.5">
          <img src="/asan-mark.png" alt="" className="h-8 w-auto shrink-0" />
          <span className="text-base font-bold text-white">LeadPilot</span>
        </div>

        <div className="relative">
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-white">{meta.headline}</h1>
          <p className="mt-3 max-w-sm text-sm text-slate-400">{meta.description}</p>

          {/* Same signal-lock motif as the login/register hero — the corner
              brackets echo the LeadPilot mark instead of an unrelated shape. */}
          <div className="relative mt-8 flex h-56 items-center justify-center overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-navy-900 via-navy-950 to-navy-950">
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(245,158,11,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.5) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
              }}
            />

            <div className="absolute size-32 rounded-full bg-amber-500/10 blur-2xl" />
            <div className="absolute size-32 rounded-full border border-amber-400/25 [animation:ping_2.8s_cubic-bezier(0,0,0.2,1)_infinite]" />
            <div className="absolute size-24 rounded-full border border-amber-400/20" />

            <svg viewBox="0 0 160 160" className="relative size-24 text-amber-400" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M8 42 V12 H38" />
              <path d="M122 12 H152 V42" />
              <path d="M152 118 V148 H122" />
              <path d="M38 148 H8 V118" />
            </svg>
            <span className="absolute size-2.5 rounded-full bg-amber-400 shadow-[0_0_18px_4px_rgba(245,158,11,0.55)]" />

            <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
              {meta.badges.map((b, i) => (
                <span
                  key={b}
                  className="inline-flex w-fit items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-medium text-white backdrop-blur-sm"
                >
                  <span className={cn("size-1.5 rounded-full", i === 0 ? "bg-emerald-400" : "bg-blue-400")} />
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="relative">
          <p className="text-sm font-semibold text-amber-400">✦ Trusted by 500+ businesses</p>
          <p className="mt-1 text-xs text-slate-500">Set up takes less than 5 minutes</p>
        </div>
      </div>

      {/* items-start (not centered): Step 3's logo dropzone makes it visibly
          taller than Step 1, and vertical centering made the whole form jump
          position between steps. Top-anchored, it holds still. */}
      <div className="flex flex-1 items-start justify-center bg-white px-6 pb-12 pt-16">
        <div className="w-full max-w-2xl">
          <div className="mb-10">
            <StepIndicator step={step} />
          </div>

          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Tell us about your business</h2>
              <p className="mt-1.5 text-sm text-slate-500">Let&apos;s set up your core organisation details.</p>

              <div className="mt-8 space-y-5">
                <Field label="Organisation Name">
                  <input
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="input"
                  />
                </Field>
                <Field label="Industry">
                  <select value={industry} onChange={(e) => setIndustry(e.target.value)} className="input">
                    <option value="" disabled>
                      Select your industry…
                    </option>
                    <option>Real Estate</option>
                    <option>SaaS</option>
                    <option>Financial Services</option>
                    <option>Education</option>
                  </select>
                </Field>
                <Field label="Website URL">
                  <input
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://..."
                    className="input"
                  />
                  <p className="mt-1.5 text-xs text-slate-500">● AI will scan this to learn about your business</p>
                </Field>
                <Field label="Primary Languages">
                  <div className="flex flex-wrap gap-2">
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => toggleLanguage(lang)}
                        className={cn(
                          "rounded-full border px-4 py-3 text-sm font-medium transition-colors",
                          languages.includes(lang)
                            ? "border-amber-600 bg-amber-50 text-amber-700"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Services & Offerings</h2>
              <p className="mt-1.5 text-sm text-slate-500">What are you selling, and who is it for?</p>

              <div className="mt-8 space-y-5">
                <Field label="Services Offered">
                  <TagInput values={services} onChange={setServices} placeholder="Type and press enter..." />
                </Field>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Field label="Pricing Range — Min (₹)" className="flex-1">
                    <input
                      type="number"
                      value={pricingMin}
                      onChange={(e) => setPricingMin(e.target.value)}
                      className="input"
                    />
                  </Field>
                  <span className="hidden text-sm text-slate-400 sm:mt-6 sm:block">to</span>
                  <Field label="Pricing Range — Max (₹)" className="flex-1">
                    <input
                      type="number"
                      value={pricingMax}
                      onChange={(e) => setPricingMax(e.target.value)}
                      className="input"
                    />
                  </Field>
                </div>
                <Field label="Target Audience">
                  <textarea
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    placeholder="Describe your ideal customer profile..."
                    rows={3}
                    className="input resize-none"
                  />
                </Field>
                <Field label="Unique Selling Propositions (USPs)">
                  <TagInput values={usps} onChange={setUsps} placeholder="E.g. Free registration..." />
                </Field>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Brand & Voice</h2>
              <p className="mt-1.5 text-sm text-slate-500">How should our AI represent you?</p>

              <div className="mt-8 space-y-5">
                <Field label="Brand Voice">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {VOICE_OPTIONS.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => setBrandVoice(v.key)}
                        className={cn(
                          "relative rounded-xl border p-4 text-left transition-colors",
                          brandVoice === v.key ? "border-amber-600 bg-amber-50" : "border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        <span className="text-sm font-semibold text-slate-900">{v.key}</span>
                        <p className={cn("text-xs", brandVoice === v.key ? "text-amber-700" : "text-slate-500")}>
                          {v.desc}
                        </p>
                        {brandVoice === v.key && (
                          <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-amber-700 text-white">
                            <Check className="size-3" />
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="Competitors">
                  <TagInput values={competitors} onChange={setCompetitors} placeholder="E.g. Lodha Group, DLF..." />
                </Field>
                <Field label="Company Logo">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/svg+xml,image/png,image/jpeg"
                    className="hidden"
                    onChange={(e) => handleLogoSelect(e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-10 text-center hover:bg-slate-50"
                  >
                    {logoDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoDataUrl} alt="Company logo preview" className="h-16 w-auto object-contain" />
                    ) : (
                      <Upload className="size-6 text-amber-600" />
                    )}
                    <p className="text-sm font-medium text-slate-700">
                      {logoDataUrl ? "Click to replace" : "Click to upload or drag & drop"}
                    </p>
                    <p className="text-xs text-slate-400">SVG, PNG, or JPG (max. 5MB)</p>
                  </button>
                  {logoError && <p className="mt-1.5 text-xs font-medium text-red-600">{logoError}</p>}
                </Field>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="text-center">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-amber-100">
                <Check className="size-7 text-amber-700" />
              </div>
              <h2 className="mt-4 text-2xl font-bold text-slate-900">Ready to launch</h2>
              <p className="mt-1.5 text-sm text-slate-500">We&apos;ll use these details to train your LeadPilot AI agents.</p>

              <div className="mt-8 overflow-hidden rounded-xl border border-slate-200 text-left">
                <div className="bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-900">Summary</div>
                <div className="grid grid-cols-1 gap-y-4 px-5 py-4 sm:grid-cols-2">
                  <SummaryItem label="Organisation" value={orgName} />
                  <SummaryItem label="Industry" value={industry} />
                  <SummaryItem label="Website" value={website} link />
                  <SummaryItem label="Brand Voice" value={brandVoice} />
                </div>
                <div className="border-t border-slate-100 px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Services</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {services.map((s) => (
                      <span key={s} className="rounded-md bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {launchError && (
                <p className="mt-4 text-sm font-medium text-red-600">{launchError}</p>
              )}

              <Button
                className="mt-6 w-full bg-amber-500 text-navy-950 hover:bg-amber-400 focus-visible:outline-amber-500"
                onClick={handleLaunch}
                disabled={launching}
              >
                {launching ? "Launching…" : "Create Organisation"}
              </Button>
            </div>
          )}

          {step !== 4 && (
            <div className="mt-10 flex items-center justify-between">
              {step > 1 ? (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  className="text-sm font-medium text-slate-500 hover:text-slate-700"
                >
                  Back
                </button>
              ) : (
                <span />
              )}
              {/* Step 1 needs the org's real name + industry before proceeding —
                  nothing is pre-filled now, so this stops a blank launch. */}
              <Button
                className="bg-amber-500 text-navy-950 hover:bg-amber-400 focus-visible:outline-amber-500"
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 1 && (!orgName.trim() || !industry)}
              >
                Continue →
              </Button>
            </div>
          )}
          {step === 4 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="mt-4 w-full text-center text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">{label}</label>
      {children}
    </div>
  );
}

function SummaryItem({ label, value, link }: { label: string; value: string; link?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn("text-sm font-semibold", link ? "text-amber-700" : "text-slate-900")}>{value}</p>
    </div>
  );
}
