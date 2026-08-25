"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  changePassword,
  updateStoredUser,
  validateNewPassword,
  type PasswordFieldErrors,
} from "@/lib/auth";

// Reached only when the DashboardChrome guard sees must_reset_password=true on
// the stored session (an admin/ad_manager invited or password-reset by a
// founder) — every other /dashboard route redirects here until this is done.
export default function ChangePasswordRequiredPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<PasswordFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const currentId = useId();
  const newId = useId();
  const confirmId = useId();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errors = validateNewPassword(currentPassword, newPassword, confirmPassword);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    // changePassword() from lib/auth deliberately bypasses api.ts's
    // authedRequest — that helper treats every 401 as a dead session and hard
    // redirects to /login, which on THIS screen would sign the user out for
    // mistyping the temporary password they were just emailed. See the long
    // comment on changePassword() for the full reasoning.
    const outcome = await changePassword({
      current_password: currentPassword,
      new_password: newPassword,
    });
    setSubmitting(false);

    if (!outcome.ok) {
      if (outcome.wrongCurrentPassword) setFieldErrors({ current: outcome.message });
      else setError(outcome.message);
      return;
    }

    updateStoredUser({ must_reset_password: outcome.user.must_reset_password });
    router.replace("/dashboard");
  }

  return (
    <div className="pb-10">
      <PageHeader
        title="Set a New Password"
        description="Your account was invited or reset with a temporary password — set your own before continuing."
      />

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="max-w-md p-5">
          {/* A real <form>, not three bare divs with a Button onClick: without
              it, Enter in a password field did nothing — on a forced-reset
              screen the single most common keyboard action. */}
          <form className="space-y-3" onSubmit={submit}>
            {error && (
              <p role="alert" className="text-xs font-medium text-red-600">
                {error}
              </p>
            )}
            <div>
              <label htmlFor={currentId} className="mb-1 block text-xs font-semibold text-slate-600">
                Current (Temporary) Password
              </label>
              <input
                id={currentId}
                type="password"
                // Lets a password manager fill the temporary password it saved
                // when the user first followed their invite email.
                autoComplete="current-password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                aria-invalid={fieldErrors.current ? true : undefined}
                aria-describedby={fieldErrors.current ? `${currentId}-error` : undefined}
              />
              {fieldErrors.current && (
                <p id={`${currentId}-error`} role="alert" className="mt-1 text-xs font-medium text-red-600">
                  {fieldErrors.current}
                </p>
              )}
            </div>
            <div>
              <label htmlFor={newId} className="mb-1 block text-xs font-semibold text-slate-600">
                New Password
              </label>
              <input
                id={newId}
                type="password"
                // Without this a password manager can't offer to save the new
                // password, which is the whole point of the invited-user flow.
                autoComplete="new-password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                placeholder="At least 8 characters"
                aria-invalid={fieldErrors.next ? true : undefined}
                aria-describedby={fieldErrors.next ? `${newId}-error` : undefined}
              />
              {fieldErrors.next && (
                <p id={`${newId}-error`} role="alert" className="mt-1 text-xs font-medium text-red-600">
                  {fieldErrors.next}
                </p>
              )}
            </div>
            <div>
              <label htmlFor={confirmId} className="mb-1 block text-xs font-semibold text-slate-600">
                Confirm New Password
              </label>
              <input
                id={confirmId}
                type="password"
                autoComplete="new-password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                aria-invalid={fieldErrors.confirm ? true : undefined}
                aria-describedby={fieldErrors.confirm ? `${confirmId}-error` : undefined}
              />
              {fieldErrors.confirm && (
                <p id={`${confirmId}-error`} role="alert" className="mt-1 text-xs font-medium text-red-600">
                  {fieldErrors.confirm}
                </p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={submitting || !currentPassword || !newPassword || !confirmPassword}
            >
              {submitting ? "Setting password…" : "Set New Password"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
