"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ApiError, authApi } from "@/lib/api";
import { updateStoredUser } from "@/lib/auth";

// Reached only when the DashboardChrome guard sees must_reset_password=true on
// the stored session (an admin/ad_manager invited or password-reset by a
// founder) — every other /dashboard route redirects here until this is done.
export default function ChangePasswordRequiredPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const user = await authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      updateStoredUser({ must_reset_password: user.must_reset_password });
      router.replace("/dashboard");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to change password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pb-10">
      <PageHeader
        title="Set a New Password"
        description="Your account was invited or reset with a temporary password — set your own before continuing."
      />

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="max-w-md p-5">
          <div className="space-y-3">
            {error && <p className="text-xs font-medium text-red-600">{error}</p>}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Current (Temporary) Password
              </label>
              <input
                type="password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">New Password</label>
              <input
                type="password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Confirm New Password</label>
              <input
                type="password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={submit}
              disabled={submitting || !currentPassword || !newPassword || !confirmPassword}
            >
              {submitting ? "Setting password…" : "Set New Password"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
