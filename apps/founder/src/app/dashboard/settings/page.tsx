"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, Bell, Building2, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ApiError, authApi } from "@/lib/api";
import { updateStoredUser } from "@/lib/auth";

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
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSubmitting, setPwSubmitting] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);

  function openChangePassword() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPwError(null);
    setPwSuccess(false);
    setPwOpen(true);
  }

  async function submitChangePassword() {
    if (newPassword !== confirmPassword) {
      setPwError("New password and confirmation don't match");
      return;
    }
    setPwSubmitting(true);
    setPwError(null);
    try {
      const user = await authApi.changePassword({ current_password: currentPassword, new_password: newPassword });
      updateStoredUser({ must_reset_password: user.must_reset_password });
      setPwSuccess(true);
    } catch (e) {
      setPwError(e instanceof ApiError ? e.message : "Failed to change password");
    } finally {
      setPwSubmitting(false);
    }
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
                className="flex-1"
                onClick={submitChangePassword}
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
          <div className="space-y-3">
            {pwError && <p className="text-xs font-medium text-red-600">{pwError}</p>}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Current Password</label>
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
          </div>
        )}
      </Modal>
    </div>
  );
}
