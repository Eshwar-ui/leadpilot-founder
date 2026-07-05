"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Upload } from "lucide-react";
import { StepIndicator } from "@/components/onboarding/StepIndicator";
import { Button } from "@/components/ui/Button";
import { TagInput } from "@/components/ui/TagInput";
import { cn } from "@/lib/utils";
import { ApiError, orgApi } from "@/lib/api";

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

  // Step 1
  const [orgName, setOrgName] = useState("TechCorp India");
  const [industry, setIndustry] = useState("Real Estate");
  const [website, setWebsite] = useState("techcorp.in");
  const [languages, setLanguages] = useState<string[]>(["English", "Hindi"]);

  // Step 2 — this is the Organisation Knowledge Base every AI feature (scoring
  // relevance, follow-up tone, script generation) reads from, so every field
  // here needs to actually persist, not just render.
  const [services, setServices] = useState<string[]>(["Premium Villas", "Commercial Plots"]);
  const [pricingMin, setPricingMin] = useState("5000000");
  const [pricingMax, setPricingMax] = useState("50000000");
  const [targetAudience, setTargetAudience] = useState("");
  const [usps, setUsps] = useState<string[]>([]);

  // Step 3
  const [brandVoice, setBrandVoice] = useState("Authoritative");
  const [competitors, setCompetitors] = useState<string[]>([]);

  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const meta = STEP_META[step - 1];

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
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary-600 text-sm font-bold text-white">
            LP
          </span>
          <span className="text-base font-bold text-white">LeadPilot</span>
        </div>

        <div>
          <h1 className="text-2xl font-bold leading-tight text-white">{meta.headline}</h1>
          <p className="mt-3 max-w-sm text-sm text-slate-400">{meta.description}</p>

          <div className="relative mt-8 h-56 overflow-hidden rounded-2xl bg-gradient-to-br from-primary-900/40 via-navy-900 to-navy-900 p-6">
            <div className="absolute -right-4 top-6 size-20 rotate-12 rounded-2xl border border-white/10" />
            <div className="absolute left-6 top-10 size-24 rotate-45 rounded-2xl border border-white/10 bg-primary-500/10" />
            <div className="absolute left-16 bottom-8 size-2.5 rounded-full bg-navy-800" />

            <div className="absolute bottom-6 left-6 flex flex-col gap-2">
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

        <div>
          <p className="text-sm font-semibold text-primary-400">✦ Trusted by 500+ businesses</p>
          <p className="mt-1 text-xs text-slate-500">Set up takes less than 5 minutes</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-white px-6 py-12">
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
                  <p className="mt-1.5 text-xs text-primary-600">● AI will scan this to learn about your business</p>
                </Field>
                <Field label="Primary Languages">
                  <div className="flex flex-wrap gap-2">
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => toggleLanguage(lang)}
                        className={cn(
                          "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                          languages.includes(lang)
                            ? "border-primary-500 bg-primary-50 text-primary-700"
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
                          brandVoice === v.key ? "border-primary-500 bg-primary-50" : "border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        <span className="text-sm font-semibold text-slate-900">{v.key}</span>
                        <p className={cn("text-xs", brandVoice === v.key ? "text-primary-600" : "text-slate-500")}>
                          {v.desc}
                        </p>
                        {brandVoice === v.key && (
                          <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary-600 text-white">
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
                  <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-10 text-center">
                    <Upload className="size-6 text-primary-500" />
                    <p className="text-sm font-medium text-slate-700">Click to upload or drag &amp; drop</p>
                    <p className="text-xs text-slate-400">SVG, PNG, or JPG (max. 5MB)</p>
                  </div>
                </Field>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="text-center">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-primary-100">
                <Check className="size-7 text-primary-600" />
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
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Extracted Services</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {services.map((s) => (
                      <span key={s} className="rounded-md bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {launchError && (
                <p className="mt-4 text-sm font-medium text-red-600">{launchError}</p>
              )}

              <Button className="mt-6 w-full" onClick={handleLaunch} disabled={launching}>
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
              <Button onClick={() => setStep((s) => s + 1)}>Continue →</Button>
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
      <p className={cn("text-sm font-semibold", link ? "text-primary-600" : "text-slate-900")}>{value}</p>
    </div>
  );
}
