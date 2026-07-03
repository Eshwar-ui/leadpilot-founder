"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  return (
    <AuthShell
      headline="Predict the future of your pipeline"
      description="LeadPilot uses deep learning to identify your next best customers before your competitors do."
      badges={[{ label: "Predictive Engine Online", tone: "emerald" }]}
    >
      <h2 className="text-3xl font-bold text-slate-900">Welcome back</h2>
      <p className="mt-2 text-sm text-slate-500">Sign in to your LeadPilot account</p>

      <form
        className="mt-8 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          router.push("/dashboard");
        }}
      >
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Email Address
          </label>
          <input
            type="email"
            placeholder="alex@acme.inc"
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
          <div className="mt-2 text-right">
            <Link href="#" className="text-xs font-medium text-primary-600 hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>

        <Button type="submit" className="w-full">
          Sign In
        </Button>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          or
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <Button type="button" variant="outline" className="w-full">
          Continue with Google
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-semibold text-primary-600 hover:underline">
          Create one →
        </Link>
      </p>
    </AuthShell>
  );
}
