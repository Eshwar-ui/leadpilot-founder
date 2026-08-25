"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { authApi, ApiError } from "@/lib/api";
import { saveSession } from "@/lib/auth";

// The handful of passwords that turn up at the top of every breach corpus,
// plus the keyboard walks people reach for when a form demands "8 characters".
// Not a security control — the backend hashes whatever it's given — but a
// meter that calls "password1" strong is worse than no meter at all.
const OBVIOUS_PASSWORDS = [
  "password",
  "passw0rd",
  "welcome",
  "letmein",
  "qwerty",
  "qwertyuiop",
  "asdfgh",
  "zxcvbn",
  "iloveyou",
  "admin",
  "administrator",
  "changeme",
  "leadpilot",
  "abc123",
  "monkey",
  "dragon",
  "sunshine",
  "princess",
  "football",
  "baseball",
  "trustno1",
  "starwars",
];

type Strength = { level: 0 | 1 | 2; label: string; hint: string };

/** Runs of 4+ consecutive characters in either direction — "1234", "abcd",
 * "4321" — which read as length to a naive meter but not to a cracker. */
function hasSequentialRun(value: string): boolean {
  let ascending = 1;
  let descending = 1;
  for (let i = 1; i < value.length; i += 1) {
    const delta = value.charCodeAt(i) - value.charCodeAt(i - 1);
    ascending = delta === 1 ? ascending + 1 : 1;
    descending = delta === -1 ? descending + 1 : 1;
    if (ascending >= 4 || descending >= 4) return true;
  }
  return false;
}

/** True when the password is a dictionary favourite, one repeated character,
 * a keyboard walk, or simply the user's own name/email handed back to us —
 * all of which a length-only meter happily rates as strong. */
function isObvious(password: string, personal: string[]): boolean {
  // Strip a trailing "1"/"123"/"!" before matching: "Password1!" is the same
  // guess as "password" to anything that runs a wordlist with mangling rules.
  const core = password.toLowerCase().replace(/[0-9!@#$%^&*_.-]+$/, "");
  if (OBVIOUS_PASSWORDS.includes(core)) return true;
  if (OBVIOUS_PASSWORDS.some((p) => p.length >= 6 && core.includes(p))) return true;
  if (/^(.)\1+$/.test(password)) return true;
  if (hasSequentialRun(password)) return true;
  return personal.some((token) => token.length >= 4 && core.includes(token.toLowerCase()));
}

/** Honest three-level assessment: length tiers plus character-class variety,
 * with an obvious-password check that overrides both. Deliberately stingy —
 * an eight-character all-lowercase password is Weak, and says so. */
function assessPassword(password: string, personal: string[]): Strength {
  if (password.length < 8) {
    return { level: 0, label: "Weak", hint: "Use at least 8 characters." };
  }
  if (isObvious(password, personal)) {
    return {
      level: 0,
      label: "Weak",
      hint: "Too easy to guess — avoid common words, keyboard runs, and your own name or email.",
    };
  }

  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  let score = 1; // ≥ 8 characters, already established above
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (classes >= 2) score += 1;
  if (classes >= 3) score += 1;
  if (classes >= 4) score += 1;

  if (score >= 5) {
    return { level: 2, label: "Strong", hint: "Good length and a healthy mix of characters." };
  }
  if (score >= 3) {
    return {
      level: 1,
      label: "Okay",
      hint:
        password.length < 12
          ? "Longer is the easiest win — aim for 12+ characters."
          : "Add another character type (uppercase, a number, or a symbol).",
    };
  }
  return {
    level: 0,
    label: "Weak",
    hint: "Mix in uppercase, numbers, or symbols — and go longer than 8 characters.",
  };
}

const STRENGTH_BAR = ["bg-red-500", "bg-amber-500", "bg-emerald-500"];
const STRENGTH_TEXT = ["text-red-600", "text-amber-600", "text-emerald-600"];

type FieldErrors = Partial<Record<"orgName" | "password" | "confirmPassword" | "terms", string>>;

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const nameId = useId();
  const orgNameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const confirmId = useId();
  const termsId = useId();
  const strengthId = useId();

  const strength = assessPassword(password, [name, email.split("@")[0] ?? "", orgName]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Everything the backend would 422/reject on, caught here so the user
    // isn't round-tripping to the server for an avoidable mistake.
    const next: FieldErrors = {};
    if (orgName.trim().length < 2) next.orgName = "Enter your organisation's name (at least 2 characters).";
    if (password.length < 8) next.password = "Use at least 8 characters.";
    if (new TextEncoder().encode(password).length > 72) {
      // bcrypt's real ceiling — the backend rejects past 72 BYTES, not chars.
      next.password = "That's too long — keep it under 72 characters.";
    }
    if (password !== confirmPassword) next.confirmPassword = "Passwords don't match.";
    if (!agreed) next.terms = "Please accept the Terms of Service and Privacy Policy to continue.";
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      const session = await authApi.register({
        // Asked for explicitly now. It was previously fabricated from the
        // user's name ("Alex Rivera's Organization") without telling them,
        // and that string is what every dashboard header and export shows.
        org_name: orgName.trim(),
        name,
        email,
        password,
      });
      saveSession(session);
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      headline={
        <>
          Turn cold emails into <span className="text-amber-400">warm intros</span>
        </>
      }
      description="Our agents research your prospects, write personalized outreach, and book meetings in your sleep."
      badges={[{ label: "Hyper-personalization Active", tone: "amber" }]}
    >
      <h2 className="text-3xl font-bold text-slate-900">Create your account</h2>
      <p className="mt-2 text-sm text-slate-600">Set up your organisation and invite your team in minutes</p>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <div>
          <label htmlFor={nameId} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Full Name
          </label>
          <input
            id={nameId}
            type="text"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Alex Rivera"
            className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm placeholder:text-slate-500 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-100"
          />
        </div>

        <div>
          <label
            htmlFor={orgNameId}
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600"
          >
            Organisation Name
          </label>
          <input
            id={orgNameId}
            type="text"
            name="organization"
            autoComplete="organization"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            required
            minLength={2}
            aria-invalid={fieldErrors.orgName ? true : undefined}
            aria-describedby={fieldErrors.orgName ? `${orgNameId}-error` : `${orgNameId}-hint`}
            placeholder="Acme Realty"
            className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm placeholder:text-slate-500 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-100"
          />
          {fieldErrors.orgName ? (
            <p id={`${orgNameId}-error`} role="alert" className="mt-1 text-xs font-medium text-red-600">
              {fieldErrors.orgName}
            </p>
          ) : (
            <p id={`${orgNameId}-hint`} className="mt-1 text-xs text-slate-600">
              Shown across your dashboard and on every export. You can rename it later in Settings.
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={emailId}
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600"
          >
            Work Email
          </label>
          <input
            id={emailId}
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="alex@company.com"
            className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm placeholder:text-slate-500 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-100"
          />
        </div>

        <div>
          <label
            htmlFor={passwordId}
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600"
          >
            Password
          </label>
          <div className="relative">
            <input
              id={passwordId}
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              aria-invalid={fieldErrors.password ? true : undefined}
              aria-describedby={fieldErrors.password ? `${passwordId}-error` : password ? strengthId : undefined}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 pr-12 text-sm placeholder:text-slate-500 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-100"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              // size-11 = 44px, the minimum comfortable touch target. The icon
              // stays 16px; the padding around it is what you actually hit.
              className="absolute right-0.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:text-slate-700"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {/* Real assessment, not password.length / 3. The bar count, the
              colour, and the copy all come from the same level — they used to
              disagree (three green bars and "Great password" for one char).
              The live region is always mounted, empty until there's something
              to say: a region that appears at the same moment as its content
              is announced inconsistently by screen readers. */}
          <div id={strengthId} aria-live="polite">
            {password.length > 0 && (
              <>
                <div className="mt-2 flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full ${
                        i <= strength.level ? STRENGTH_BAR[strength.level] : "bg-slate-200"
                      }`}
                    />
                  ))}
                </div>
                <p className={`mt-1 text-xs ${STRENGTH_TEXT[strength.level]}`}>
                  <span className="font-semibold">{strength.label}.</span> {strength.hint}
                </p>
              </>
            )}
          </div>
          {fieldErrors.password && (
            <p id={`${passwordId}-error`} role="alert" className="mt-1 text-xs font-medium text-red-600">
              {fieldErrors.password}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={confirmId}
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600"
          >
            Confirm Password
          </label>
          <input
            id={confirmId}
            type={showPassword ? "text" : "password"}
            name="confirmPassword"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            aria-invalid={fieldErrors.confirmPassword ? true : undefined}
            aria-describedby={fieldErrors.confirmPassword ? `${confirmId}-error` : undefined}
            placeholder="••••••••"
            className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm placeholder:text-slate-500 focus:border-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-100"
          />
          {fieldErrors.confirmPassword && (
            <p id={`${confirmId}-error`} role="alert" className="mt-1 text-xs font-medium text-red-600">
              {fieldErrors.confirmPassword}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-start gap-2.5 text-sm text-slate-600">
            <input
              id={termsId}
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              aria-invalid={fieldErrors.terms ? true : undefined}
              aria-describedby={fieldErrors.terms ? `${termsId}-error` : undefined}
              className="mt-0.5 size-4 rounded border-slate-300 accent-amber-600"
            />
            <label htmlFor={termsId}>
              {/* /privacy is a real page now (app/privacy/page.tsx), so the
                  Privacy Policy is a genuine link — opened in a new tab so
                  reading it doesn't wipe the half-filled form behind it.
                  There is still no Terms of Service page, so "Terms of
                  Service" deliberately stays plain text rather than a "#"
                  link that looks clickable and does nothing. */}
              I agree to LeadPilot&apos;s Terms of Service and{" "}
              <Link
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-amber-700 hover:underline"
              >
                Privacy Policy
              </Link>
            </label>
          </div>
          {fieldErrors.terms && (
            <p id={`${termsId}-error`} role="alert" className="mt-1 text-xs font-medium text-red-600">
              {fieldErrors.terms}
            </p>
          )}
        </div>

        {/* Not disabled on !agreed: a dead button gives no reason for being
            dead. Submitting surfaces the checkbox error instead. */}
        <Button
          type="submit"
          className="w-full bg-amber-500 text-navy-950 hover:bg-amber-400 focus-visible:outline-amber-500"
          disabled={submitting}
        >
          {submitting ? "Creating account…" : "Create Account"}
        </Button>

        <p className="text-center text-sm text-slate-600">You&apos;ll finish setting up your organisation next →</p>
      </form>

      <p className="mt-2 text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-amber-700 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
