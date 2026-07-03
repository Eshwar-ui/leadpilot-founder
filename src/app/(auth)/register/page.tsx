"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const router = useRouter();

  const strength = Math.min(3, Math.floor(password.length / 3));

  return (
    <AuthShell
      headline="Turn cold emails into warm intros"
      description="Our agents research your prospects, write personalized outreach, and book meetings in your sleep."
      badges={[{ label: "Hyper-personalization Active", tone: "amber" }]}
    >
      <h2 className="text-3xl font-bold text-slate-900">Create your account</h2>
      <p className="mt-2 text-sm text-slate-500">Start your free trial — no credit card required</p>

      <form
        className="mt-8 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          router.push("/onboarding");
        }}
      >
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Full Name
          </label>
          <input
            type="text"
            placeholder="Alex Rivera"
            className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Work Email
          </label>
          <input
            type="email"
            placeholder="alex@company.com"
            className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-200 px-4 py-2.5 pr-10 text-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {password.length > 0 && (
            <>
              <div className="mt-2 flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full ${
                      i <= strength ? "bg-emerald-500" : "bg-slate-200"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-emerald-600">Great password. Keep it secure.</p>
            </>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Confirm Password
          </label>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>

        <label className="flex items-start gap-2.5 text-sm text-slate-600">
          <input type="checkbox" defaultChecked className="mt-0.5 size-4 rounded border-slate-300 text-primary-600" />
          <span>
            I agree to LeadPilot&apos;s{" "}
            <Link href="#" className="font-medium text-primary-600 hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="#" className="font-medium text-primary-600 hover:underline">
              Privacy Policy
            </Link>
          </span>
        </label>

        <Button type="submit" className="w-full">
          Create Account
        </Button>

        <p className="text-center text-sm text-slate-400">You&apos;ll set up your organisation next →</p>
      </form>

      <p className="mt-2 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary-600 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
