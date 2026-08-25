"use client";

import { markReachable, markUnreachable } from "@/lib/connectivity";
import type { AuthResponse, AuthUser } from "@/lib/api";

const TOKEN_KEY = "leadpilot_token";
const USER_KEY = "leadpilot_user";

// Mirrors api.ts's API_URL. Duplicated rather than imported because api.ts
// already imports getToken/clearSession from this module — importing a VALUE
// back out of it would close a runtime import cycle. (The `AuthUser` import
// above is type-only, so it erases at compile time and is cycle-free.)
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function saveSession(session: AuthResponse) {
  localStorage.setItem(TOKEN_KEY, session.access_token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function updateStoredOrgName(orgName: string) {
  const user = getStoredUser();
  if (!user) return;
  localStorage.setItem(USER_KEY, JSON.stringify({ ...user, org_name: orgName }));
}

// ── Change password ────────────────────────────────────────────────────────
//
// WHY THIS DOESN'T GO THROUGH api.ts's authApi.changePassword():
//
// authedRequest() in api.ts treats EVERY 401 as "the stored session is dead",
// so it clears the session and hard-redirects to /login. That is right for
// every other authenticated endpoint — but POST /api/auth/change-password
// returns 401 for one entirely different reason: `current_password` didn't
// match (see change_password() in the backend's app/api/auth.py). Routed
// through authedRequest, simply mistyping the temporary password from your
// invite email SIGNS YOU OUT instead of saying "that's the wrong password" —
// and on the forced-reset screen that is an unrecoverable loop for anyone who
// no longer has the email to hand.
//
// So this call carries the bearer token itself and interprets its own
// response. It returns an outcome object rather than throwing, both to keep
// the "wrong current password" case explicitly distinguishable at the call
// site and to avoid importing api.ts's ApiError class (see the API_URL note
// at the top of this file — that import would be a runtime cycle).
export type PasswordFieldErrors = Partial<Record<"current" | "next" | "confirm", string>>;

/** Client-side mirror of the backend's rules — `Password = Field(min_length=8)`
 * plus a hard 72-BYTE bcrypt ceiling (schemas_auth.py) — so the everyday
 * mistakes never cost a round trip, and "same as current" never reaches the
 * server at all. Shared by the forced-reset screen and the Settings dialog so
 * the two can't drift apart. */
export function validateNewPassword(
  current: string,
  next: string,
  confirm: string
): PasswordFieldErrors {
  const errors: PasswordFieldErrors = {};
  if (!current) errors.current = "Enter your current password.";
  if (next.length < 8) {
    errors.next = "Use at least 8 characters.";
  } else if (new TextEncoder().encode(next).length > 72) {
    // bcrypt ignores everything past 72 BYTES, so the backend rejects rather
    // than silently truncating. Count bytes, not characters — an emoji or an
    // accented character is more than one.
    errors.next = "That's too long — keep it under 72 characters.";
  } else if (current && next === current) {
    errors.next = "Your new password must be different from your current one.";
  }
  if (next !== confirm) errors.confirm = "New password and confirmation don't match.";
  return errors;
}

export type ChangePasswordOutcome =
  | { ok: true; user: AuthUser }
  | { ok: false; message: string; wrongCurrentPassword: boolean };

/** Flattens FastAPI's two `detail` shapes — a plain string from HTTPException,
 * or an array of {loc, msg} from a Pydantic failure — into one line. Same idea
 * as humanizeError() in api.ts, which isn't exported. */
function detailToMessage(detail: unknown): string | null {
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((e) => (e as { msg?: string })?.msg)
      .filter((m): m is string => Boolean(m));
    if (msgs.length) return msgs.join(". ");
  }
  return null;
}

export async function changePassword(input: {
  current_password: string;
  new_password: string;
}): Promise<ChangePasswordOutcome> {
  const token = getToken();
  if (!token) {
    return { ok: false, message: "You're not signed in. Sign in again to continue.", wrongCurrentPassword: false };
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/auth/change-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    });
  } catch {
    // fetch only throws when the server is unreachable (DNS/refused/CORS),
    // never for a 4xx — feed the global <ConnectivityBanner> the same way
    // api.ts's request() does.
    markUnreachable();
    return { ok: false, message: "Can't reach the server. Check your connection and try again.", wrongCurrentPassword: false };
  }

  if (res.status >= 500) markUnreachable();
  else markReachable();

  if (res.ok) {
    return { ok: true, user: (await res.json()) as AuthUser };
  }

  const body = await res.json().catch(() => null);
  const detail = detailToMessage((body as { detail?: unknown } | null)?.detail);

  if (res.status === 401) {
    // The ONLY 401 this endpoint emits is the wrong-current-password one; a
    // genuinely expired token fails earlier, in get_current_user, with the
    // same status — so we surface it as a field error and deliberately do NOT
    // clear the session. Worst case the user retries and sees it again.
    return {
      ok: false,
      message: detail ?? "Current password is incorrect.",
      wrongCurrentPassword: true,
    };
  }

  if (res.status === 429) {
    return { ok: false, message: "Too many attempts. Wait a minute and try again.", wrongCurrentPassword: false };
  }

  return {
    ok: false,
    message:
      detail ??
      (res.status >= 500
        ? "Something went wrong on our end. Try again in a moment."
        : "Couldn't change your password. Check your details and try again."),
    wrongCurrentPassword: false,
  };
}

// Called after a successful POST /api/auth/change-password so the stored
// session reflects must_reset_password=false without requiring a re-login.
export function updateStoredUser(patch: Partial<AuthUser>) {
  const user = getStoredUser();
  if (!user) return;
  localStorage.setItem(USER_KEY, JSON.stringify({ ...user, ...patch }));
}
