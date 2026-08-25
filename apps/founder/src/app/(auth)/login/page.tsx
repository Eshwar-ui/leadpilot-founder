"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { authApi, ApiError } from "@/lib/api";
import { saveSession } from "@/lib/auth";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const emailId = useId();
  const passwordId = useId();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const session = await authApi.login({ email, password });
      saveSession(session);
      router.push("/dashboard");
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
          Predict the future of your <span className="text-gold-400">pipeline</span>
        </>
      }
      description="LeadPilot uses deep learning to identify your next best customers before your competitors do."
      badges={[{ label: "Predictive Engine Online", tone: "emerald" }]}
    >
      <h2 className="text-3xl font-bold text-slate-900">Welcome back</h2>
      <p className="mt-2 text-sm text-slate-600">Sign in to your LeadPilot account</p>

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
          <label
            htmlFor={emailId}
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600"
          >
            Email Address
          </label>
          <input
            id={emailId}
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="alex@acme.inc"
            className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm placeholder:text-slate-500 focus:border-gold-600 focus:outline-none focus:ring-2 focus:ring-gold-100"
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 pr-12 text-sm placeholder:text-slate-500 focus:border-gold-600 focus:outline-none focus:ring-2 focus:ring-gold-100"
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
        </div>

        <Button
          type="submit"
          className="w-full bg-gold-500 text-navy-950 hover:bg-gold-400 focus-visible:outline-gold-500"
          disabled={submitting}
        >
          {submitting ? "Signing in…" : "Sign In"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-semibold text-gold-700 hover:underline">
          Create one →
        </Link>
      </p>
    </AuthShell>
  );
}
