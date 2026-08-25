"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Users, Bell, Building2, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import {
  changePassword,
  updateStoredUser,
  validateNewPassword,
  type PasswordFieldErrors,
} from "@/lib/auth";

const CARDS = [
  {
    icon: Users,
    title: "Users & Roles",
    description: "Manage founder, manager, and telecaller accounts.",
    href: "/dashboard/settings/users",
  },
  {
    icon: Bell,
    title: "Alert Configuration",
    description: "Set thresholds for every alert type.",
    href: "/dashboard/settings/alerts",
  },
  {
    icon: Building2,
    title: "Organisation Profile",
    description: "The knowledge base every AI feature reads from.",
    href: "/dashboard/settings/org",
  },
];

export default function SettingsPage() {
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwFieldErrors, setPwFieldErrors] = useState<PasswordFieldErrors>({});
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);

  // The dialog's inputs live in Modal's `children` while its submit button
  // lives in `footer`, i.e. outside the <form>. `form={pwFormId}` on that
  // button associates the two, which is what makes Enter-to-submit work from
  // inside any of the password fields.
  const pwFormId = useId();
  const currentId = useId();
  const newId = useId();
  const confirmId = useId();

  function openChangePassword() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPwFieldErrors({});
    setPwError(null);
    setPwSuccess(false);
    setPwOpen(true);
  }

  async function submitChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);

    const errors = validateNewPassword(currentPassword, newPassword, confirmPassword);
    setPwFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setPwSubmitting(true);
    // Same reason as the forced-reset screen: api.ts's authedRequest turns the
    // backend's "current password is incorrect" 401 into a session wipe and a
    // redirect to /login. changePassword() in lib/auth carries the token
    // itself so a typo stays a field error. See its comment for the details.
    const outcome = await changePassword({
      current_password: currentPassword,
      new_password: newPassword,
    });
    setPwSubmitting(false);

    if (!outcome.ok) {
      if (outcome.wrongCurrentPassword) setPwFieldErrors({ current: outcome.message });
      else setPwError(outcome.message);
      return;
    }

    updateStoredUser({ must_reset_password: outcome.user.must_reset_password });
    setPwSuccess(true);
  }

  return (
    <div className="pb-10">
      <PageHeader title="Settings" description="Portal configuration, users, and notification rules" />

      <div className="mt-6 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 sm:grid-cols-2">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href}>
            <Card className="flex h-full items-start gap-4 p-5 transition-colors hover:border-primary-200 hover:bg-primary-50/30">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                <c.icon className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{c.title}</p>
                <p className="mt-0.5 text-sm text-slate-500">{c.description}</p>
              </div>
            </Card>
          </Link>
        ))}

        <button onClick={openChangePassword} className="text-left">
          <Card className="flex h-full items-start gap-4 p-5 transition-colors hover:border-primary-200 hover:bg-primary-50/30">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
              <KeyRound className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Account &amp; Security</p>
              <p className="mt-0.5 text-sm text-slate-500">Change the password for your own login.</p>
            </div>
          </Card>
        </button>
      </div>

      <Modal
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        title={pwSuccess ? "Password Changed" : "Change Password"}
        footer={
          pwSuccess ? (
            <Button size="sm" className="w-full" onClick={() => setPwOpen(false)}>
              Done
            </Button>
          ) : (
            <>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setPwOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                type="submit"
                form={pwFormId}
                className="flex-1"
                disabled={pwSubmitting || !currentPassword || !newPassword || !confirmPassword}
              >
                {pwSubmitting ? "Changing…" : "Change Password"}
              </Button>
            </>
          )
        }
      >
        {pwSuccess ? (
          <p>Your password has been updated. Use it next time you sign in.</p>
        ) : (
          <form id={pwFormId} className="space-y-3" onSubmit={submitChangePassword}>
            {pwError && (
              <p role="alert" className="text-xs font-medium text-red-600">
                {pwError}
              </p>
            )}
            <div>
              <label htmlFor={currentId} className="mb-1 block text-xs font-semibold text-slate-600">
                Current Password
              </label>
              <input
                id={currentId}
                type="password"
                autoComplete="current-password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                aria-invalid={pwFieldErrors.current ? true : undefined}
                aria-describedby={pwFieldErrors.current ? `${currentId}-error` : undefined}
              />
              {pwFieldErrors.current && (
                <p id={`${currentId}-error`} role="alert" className="mt-1 text-xs font-medium text-red-600">
                  {pwFieldErrors.current}
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
                // Lets the password manager offer to save the replacement
                // instead of leaving the old one cached and wrong.
                autoComplete="new-password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                placeholder="At least 8 characters"
                aria-invalid={pwFieldErrors.next ? true : undefined}
                aria-describedby={pwFieldErrors.next ? `${newId}-error` : undefined}
              />
              {pwFieldErrors.next && (
                <p id={`${newId}-error`} role="alert" className="mt-1 text-xs font-medium text-red-600">
                  {pwFieldErrors.next}
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
                aria-invalid={pwFieldErrors.confirm ? true : undefined}
                aria-describedby={pwFieldErrors.confirm ? `${confirmId}-error` : undefined}
              />
              {pwFieldErrors.confirm && (
                <p id={`${confirmId}-error`} role="alert" className="mt-1 text-xs font-medium text-red-600">
                  {pwFieldErrors.confirm}
                </p>
              )}
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
