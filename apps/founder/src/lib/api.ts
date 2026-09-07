import { clearSession, getToken } from "@/lib/auth";
import { markReachable, markUnreachable } from "@/lib/connectivity";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type AuthUser = {
  id: string;
  org_id: string;
  org_name: string;
  email: string;
  name: string;
  role: string;
  must_reset_password: boolean;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// FastAPI speaks two different `detail` shapes. HTTPException sends a string;
// a Pydantic validation failure sends an ARRAY of {loc, msg, type} objects
// (see app/main.py's RequestValidationError handler). Passing that array
// straight into Error() stringifies it to the literal "[object Object]", which
// is what every form in this app used to show on a 422. Flatten it, and give
// the status codes that carry no useful detail some human copy.
function humanizeError(status: number, detail: unknown): string {
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((e) => {
        const d = e as { loc?: unknown[]; msg?: string };
        if (!d?.msg) return null;
        // loc looks like ["body", "new_password"] — the last segment is the field.
        const field = Array.isArray(d.loc)
          ? d.loc.filter((p) => p !== "body" && p !== "query").at(-1)
          : undefined;
        const label = typeof field === "string" ? prettyField(field) : null;
        return label ? `${label}: ${d.msg}` : d.msg;
      })
      .filter(Boolean);
    if (msgs.length) return msgs.join(". ");
  }
  if (typeof detail === "string" && detail) return detail;

  switch (status) {
    case 401:
      return "Your session has expired. Sign in again to continue.";
    case 403:
      return "You don't have access to this. Ask a founder or admin on your team.";
    case 404:
      return "We couldn't find that — it may have been deleted.";
    case 409:
      return "That conflicts with something that already exists.";
    case 429:
      return "Too many attempts. Wait a minute and try again.";
    case 503:
      return "The server is busy right now. Try again in a moment.";
    default:
      return status >= 500
        ? "Something went wrong on our end. Try again, or contact support if it keeps happening."
        : "That didn't work. Check your details and try again.";
  }
}

function prettyField(field: string): string {
  return field.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch (err) {
    // fetch throws (not a rejected-with-status response) on DNS failure,
    // connection refused, CORS block, or timeout — i.e. the server itself is
    // unreachable, not just this one request failing. Feeds the global
    // <ConnectivityBanner>.
    markUnreachable();
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  // Any response at all — even a 4xx application error — proves the server
  // is up; only 5xx counts as a server-side connectivity issue.
  if (res.status >= 500) {
    markUnreachable();
  } else {
    markReachable();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, humanizeError(res.status, body?.detail));
  }
  return res.json() as Promise<T>;
}

// Same as request(), but attaches the stored session token — used by every
// endpoint that requires login (everything except register/login themselves).
async function authedRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  if (!token) throw new ApiError(401, "Not signed in");
  try {
    return await request<T>(path, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...options.headers },
    });
  } catch (err) {
    // A 401 on an authenticated request means the stored session is dead —
    // expired, or (as after a DB reseed) pointing at a user that no longer
    // exists. Clear it and bounce to login instead of letting every dashboard
    // fetch loop on 401 forever.
    if (err instanceof ApiError && err.status === 401 && typeof window !== "undefined") {
      clearSession();
      if (window.location.pathname !== "/login") window.location.assign("/login");
    }
    throw err;
  }
}

export const authApi = {
  register(input: { org_name: string; name: string; email: string; password: string }) {
    return request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  login(input: { email: string; password: string }) {
    return request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  me(token: string) {
    return request<AuthUser>("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
  changePassword(input: { current_password: string; new_password: string }) {
    return authedRequest<AuthUser>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};

export type AlertConfig = {
  wastage_days: number | null;
  zombie_days: number | null;
  performance_gap: number | null;
  quality_floor: number | null;
  break_threshold_min: number | null;
  inactive_threshold_min: number | null;
  /** Days without a visit before a client is due for recall. */
  recall_days: number | null;
};

export type OrgProfile = {
  id: string;
  name: string;
  slug: string;
  industry: string | null;
  website_url: string | null;
  services: string[] | null;
  pricing_min: number | null;
  pricing_max: number | null;
  target_audience: string | null;
  competitors: string[] | null;
  brand_voice: string | null;
  languages: string[] | null;
  usps: string[] | null;
  monthly_revenue_target: number | null;
  logo_url: string | null;
  address: string | null;
  alert_config: AlertConfig | null;
  strict_lead_scoping: boolean;
};

export type OrgProfileInput = Partial<Omit<OrgProfile, "id" | "slug">>;

export const orgApi = {
  get() {
    return authedRequest<OrgProfile>("/api/auth/org");
  },
  update(input: OrgProfileInput) {
    return authedRequest<OrgProfile>("/api/auth/org", {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
};

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  status: "Active" | "Inactive";
  calls: number;
  leads: number;
  quality: number | null;
  last_active: string | null;
};

export type InviteMemberResponse = {
  member: TeamMember;
  temp_password: string;
};

export const teamApi = {
  list() {
    return authedRequest<TeamMember[]>("/api/team");
  },
  invite(input: { email: string; name: string; role: string; phone?: string }) {
    return authedRequest<InviteMemberResponse>("/api/team/invite", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  // Every field is optional and only sent when present — a PATCH that just
  // flips is_active must not blank out the member's phone. Passing phone: ""
  // is the deliberate exception: it clears the stored number.
  update(
    userId: string,
    input: { role?: string; is_active?: boolean; name?: string; email?: string; phone?: string }
  ) {
    return authedRequest<TeamMember>(`/api/team/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  resetPassword(userId: string, newPassword?: string) {
    return authedRequest<InviteMemberResponse>(`/api/team/${userId}/reset-password`, {
      method: "POST",
      body: JSON.stringify(newPassword ? { new_password: newPassword } : {}),
    });
  },
  sendNotification(userId: string, input: { title: string; message: string }) {
    return authedRequest<{ sent: boolean; recipient_id: string; recipient_name: string }>(
      `/api/team/${userId}/notification`,
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    );
  },
};

export type BoardLead = {
  id: string;
  display_id: string;
  name: string;
  phone: string | null;
  reason: string | null;
  source: string | null;
  score: number | null;
  pipeline_stage: string;
  deal_value: number | null;
  telecaller_name: string | null;
  /** The owner's user id, alongside their name — so a screen can book work
   *  into their queue rather than only display who they are. */
  assigned_to: string | null;
  days_stuck: number;
  // Who ADDED this lead, as opposed to who owns it — the two differ whenever
  // a founder adds a lead and assigns it out. Null for leads created before
  // provenance was tracked; the UI says "Not recorded" rather than guessing.
  created_by_name: string | null;
  created_by_role: string | null;
  // Customer status — derived from Lead.client_since on the backend, and
  // deliberately independent of pipeline_stage: a reopened deal is still a
  // client. See the column comment in models.py for why this isn't a stage.
  is_client: boolean;
  client_since: string | null;
  /** Summed from logged visits — real money received. 0 for a client with no
   *  visits recorded yet, which is a real, actionable state (someone forgot to
   *  log them), not missing data. */
  lifetime_value: number;
  last_visit_at: string | null;
  /** Computed server-side so the rule and its threshold live in ONE place.
   *  False for a client with no visits logged — that's a record-keeping gap,
   *  not a customer who stopped coming. */
  recall_due: boolean;
  created_at: string | null;
};

export type ArchivedLead = {
  id: string;
  display_id: string;
  name: string;
  phone: string | null;
  source: string | null;
  pipeline_stage: string;
  deal_value: number | null;
  telecaller_name: string | null;
  created_by_name: string | null;
  deleted_by_name: string | null;
  deleted_at: string | null;
};

export type LeadsBoard = {
  stages: string[];
  leads: BoardLead[];
  /** The org's recall window, so screens can explain the rule behind
   *  `recall_due` rather than restating a number that could drift from it. */
  recall_days: number;
};

export type Touchpoint = {
  call_id: string;
  timestamp: string | null;
  lead_verdict: string | null;
  score: number | null;
  summary: string | null;
  // Real per-call sentiment — the same field the mobile app's history shows.
  sentiment: string | null;
  /** "completed" | "not_relevant". A not-relevant call (wrong number, no real
   *  conversation) still belongs in the thread — it happened — but the AI
   *  explicitly does NOT stand behind its score, so the UI hides the number
   *  rather than presenting it as a verdict on the lead. */
  analysis_status: string | null;
  /** Why the analyser called it not relevant, when it did. */
  relevance_reason: string | null;
  has_audio: boolean;
  duration_label: string | null;
};

export type ScoreHistoryPoint = { timestamp: string | null; score: number };

// MemoryFact / MemoryBubble are declared once, below, alongside callsApi —
// both this lead-detail response and /calls/{id}/memory serialize the same
// backend MemoryBubble row (see _serialize_bubble in app/api/calls.py).

export type LeadFollowUp = { note: string | null; due_at: string | null };

export type DuplicateLead = { id: string; name: string; pipeline_stage: string };

/** The newest analysed call for a lead, returned inline with lead detail so
 *  the Latest Call section renders without extra round-trips. */
export type LatestCall = {
  call_id: string;
  timestamp: string | null;
  // Whether a recording actually exists. The player is only rendered when
  // this is true — otherwise we'd offer playback that 404s.
  has_audio: boolean;
  // "MM:SS", derived from the last transcript turn (there is no duration
  // column), so it can be absent for a call with no transcript.
  duration_label: string | null;
  capture_source: string | null;
  score: number | null;
  lead_verdict: string | null;
  sentiment_label: string | null;
  bant_breakdown: Record<string, { score?: number; reason?: string }> | null;
  entities: Record<string, unknown> | null;
  call_summary: CallSummary | null;
  headline: string | null;
  key_points: string[];
  next_steps: { step?: number; text?: string; action_type?: string; action_label?: string }[];
};

export type LeadDetail = {
  // NULLABLE: a contact with calls but no Lead row returns id: null and
  // pipeline_stage: null (a documented, supported path in the backend).
  // Guard before calling .slice()/.startsWith() on either.
  id: string | null;
  display_id: string | null;
  name: string;
  phone: string | null;
  reason: string | null;
  source: string | null;
  pipeline_stage: string | null;
  deal_value: number | null;
  score: number | null;
  telecaller_name: string | null;
  // The owner's id, so the Edit modal can preselect the current telecaller
  // instead of offering a "(keep current)" placeholder.
  assigned_to: string | null;
  days_stuck: number;
  created_at: string | null;
  created_by_name: string | null;
  created_by_role: string | null;
  is_client: boolean;
  client_since: string | null;
  /** Services + visit history. Null for a lead who isn't a client, so the
   *  Client tab simply doesn't exist for them. */
  client: ClientRecord | null;
  touchpoints: Touchpoint[];
  // null when the lead has no analysed call yet — the section is omitted
  // rather than rendered empty.
  latest_call: LatestCall | null;
  score_history: ScoreHistoryPoint[];
  memory: MemoryBubble | null;
  follow_up: LeadFollowUp | null;
  duplicates: DuplicateLead[];
};

/** What PATCH /api/leads/{id}/details returns — deliberately a subset of
 *  LeadDetail. Kept as its own type so it can never be mistaken for one. */
export type LeadDetailsPatch = {
  id: string;
  name: string;
  phone: string | null;
  reason: string | null;
  source: string | null;
  pipeline_stage: string | null;
  deal_value: number | null;
  telecaller_name: string | null;
  is_client: boolean;
  client_since: string | null;
  /** Summed from logged visits. 0 for a client with no visits recorded yet —
   *  which is a real, actionable state, not missing data. */
  lifetime_value: number;
  last_visit_at: string | null;
};


// ─── Bulk lead import ────────────────────────────────────────────────────────

export type ImportParseResult = {
  columns: string[];
  rows: Record<string, string>[];
  row_count: number;
  // Which column the server thinks holds each field. Null where it couldn't
  // tell — the mapping step makes the founder choose.
  suggested_mapping: Record<ImportField, string | null>;
  // True when the file had MORE rows than the server will take. Surfaced, not
  // swallowed: an import that quietly stops partway is how half a list goes
  // missing without anyone noticing.
  truncated: boolean;
  max_rows: number;
};

export type ImportField = "name" | "phone" | "source" | "reason";

export type ImportRowStatus = "ok" | "duplicate" | "invalid";

export type ImportValidatedRow = {
  index: number;
  status: ImportRowStatus;
  errors: string[];
  duplicate_of?: string | null;
  name: string;
  phone: string;
  source: string;
  reason: string;
};

export type ImportValidateResult = {
  rows: ImportValidatedRow[];
  summary: { ok: number; duplicate: number; invalid: number };
};

export type ImportCommitResult = {
  created: number;
  // An archived lead for that number was revived in place rather than
  // duplicated, keeping its existing call history attached.
  restored: number;
  skipped: number;
  failed: { index: number; name?: string; phone?: string; reason: string }[];
  notified: number;
};

export const leadImportApi = {
  // Multipart, so this bypasses authedRequest's JSON Content-Type — the
  // browser must set the multipart boundary itself.
  async parse(file: File): Promise<ImportParseResult> {
    const token = getToken();
    if (!token) throw new ApiError(401, "Not signed in");
    const form = new FormData();
    form.append("file", file);
    let res: Response;
    try {
      res = await fetch(`${API_URL}/api/leads/import/parse`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
    } catch {
      throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
    }
    if (!res.ok) {
      const detail = await res.json().catch(() => null);
      throw new ApiError(res.status, detail?.detail ?? "Couldn't read that file.");
    }
    return res.json();
  },
  validate(rows: Record<string, string>[], mapping: Record<string, string | null>) {
    return authedRequest<ImportValidateResult>("/api/leads/import/validate", {
      method: "POST",
      body: JSON.stringify({ rows, mapping }),
    });
  },
  commit(
    rows: { name: string; phone: string; source?: string; reason?: string; assigned_to?: string }[],
    assignedTo?: string
  ) {
    return authedRequest<ImportCommitResult>("/api/leads/import/commit", {
      method: "POST",
      body: JSON.stringify({ rows, ...(assignedTo ? { assigned_to: assignedTo } : {}) }),
    });
  },
  telecallers() {
    return authedRequest<{
      telecallers: { id: string; name: string }[];
      default_owner_id: string | null;
    }>("/api/leads/import/telecallers");
  },
};


// ─── Client records (services + visits) ──────────────────────────────────────

export type OrgService = {
  id: string;
  name: string;
  /** The usual price. Overridable per visit — clinics discount and bundle
   *  constantly, so this is a default, never what someone actually paid. */
  default_price: number | null;
  category: string | null;
  /** Retired services stay on past visits but drop out of the picker. */
  is_active: boolean;
};

export type ClientPackage = {
  id: string;
  service_id: string | null;
  service_name: string;
  total_sessions: number;
  /** Derived from the visit line items pointing at this package, never stored
   *  — so deleting a visit hands the session back automatically. */
  sessions_used: number;
  sessions_remaining: number;
  is_exhausted: boolean;
  /** Charged ONCE, at purchase. Sessions drawn from it carry no price, so a
   *  6-session package counts once in lifetime value rather than six times. */
  amount: number | null;
  purchased_at: string | null;
  notes: string | null;
};

export type VisitService = {
  id: string;
  service_id: string | null;
  /** Set when this session came out of a prepaid package rather than being
   *  paid for on the day. */
  package_id?: string | null;
  /** A snapshot taken when the visit was logged — renaming the service later
   *  does not rewrite what past visits say was done. */
  name: string;
  price: number | null;
};

export type ClientVisit = {
  id: string;
  visited_at: string | null;
  amount: number | null;
  notes: string | null;
  logged_by: string | null;
  services: VisitService[];
};

export type ClientRecord = {
  visits: ClientVisit[];
  visit_count: number;
  packages: ClientPackage[];
  /** Summed from VISITS — real money received. Deliberately not `deal_value`,
   *  which is one figure captured at conversion and says nothing about repeat
   *  business, which is the whole point for a clinic. */
  lifetime_value: number;
  first_visit_at: string | null;
  last_visit_at: string | null;
};

export type VisitServiceInput = {
  service_id?: string;
  name?: string;
  price?: number | null;
  /** Draw this session from a prepaid package instead of charging for it. */
  package_id?: string;
};

export type VisitInput = {
  visited_at?: string;
  amount?: number | null;
  notes?: string;
  services?: VisitServiceInput[];
};

export const servicesApi = {
  list(includeInactive = false) {
    return authedRequest<{ services: OrgService[] }>(
      `/api/services${includeInactive ? "?include_inactive=true" : ""}`
    );
  },
  create(input: { name: string; default_price?: number | null; category?: string }) {
    return authedRequest<OrgService>("/api/services", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  update(
    id: string,
    input: { name?: string; default_price?: number | null; category?: string; is_active?: boolean }
  ) {
    return authedRequest<OrgService>(`/api/services/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  // Pull the treatments already listed on the Organisation Profile into this
  // priced list, instead of typing them a second time. Names already present
  // are skipped, so running it twice is a no-op.
  importFromProfile() {
    return authedRequest<{ created: string[]; skipped: string[]; available: number }>(
      "/api/services/import-from-profile",
      { method: "POST" }
    );
  },
};

export const visitsApi = {
  // Every mutation returns the client's WHOLE refreshed record, so the tab's
  // totals can never drift from its rows.
  list(leadId: string) {
    return authedRequest<ClientRecord>(`/api/leads/${leadId}/visits`);
  },
  create(leadId: string, input: VisitInput) {
    return authedRequest<ClientRecord>(`/api/leads/${leadId}/visits`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  update(visitId: string, input: VisitInput) {
    return authedRequest<ClientRecord>(`/api/visits/${visitId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  remove(visitId: string) {
    return authedRequest<ClientRecord>(`/api/visits/${visitId}`, { method: "DELETE" });
  },
};

export type FollowUp = {
  id: string;
  lead_id: string | null;
  telecaller_id: string;
  note: string | null;
  due_at: string;
  completed_at: string | null;
};

export const followUpsApi = {
  /** Books a follow-up. `telecaller_id` is the owner's queue it lands in —
   *  the founder dashboard always sets it, because a task on the founder's own
   *  list is a task nobody sees in the mobile app. */
  create(input: { lead_id?: string; telecaller_id?: string; note?: string; due_at: string }) {
    return authedRequest<FollowUp>("/api/follow-ups", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};

export const packagesApi = {
  create(
    leadId: string,
    input: {
      service_id?: string;
      service_name?: string;
      total_sessions: number;
      amount?: number | null;
      purchased_at?: string;
      notes?: string;
    }
  ) {
    return authedRequest<ClientRecord>(`/api/leads/${leadId}/packages`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  update(
    packageId: string,
    input: { total_sessions?: number; amount?: number | null; purchased_at?: string; notes?: string }
  ) {
    return authedRequest<ClientRecord>(`/api/packages/${packageId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
  remove(packageId: string) {
    return authedRequest<ClientRecord>(`/api/packages/${packageId}`, { method: "DELETE" });
  },
};

export const leadsApi = {
  board() {
    return authedRequest<LeadsBoard>("/api/leads/board");
  },
  detail(leadId: string) {
    return authedRequest<LeadDetail>(`/api/leads/${leadId}`);
  },
  // Mark/unmark a lead as a customer. Goes through the lead-details endpoint
  // (not the stage endpoint) because customer status is deliberately NOT a
  // pipeline stage — see Lead.client_since.
  //
  // Returns a SUBSET of LeadDetail, not the whole thing: /details has no
  // touchpoints, memory or latest_call. Callers must MERGE this into the lead
  // they already hold — assigning it wholesale strips those fields and blows
  // up the first render that reads `touchpoints.length`.
  // Marking a client also moves the lead to Closed Won (the backend does it
  // through the normal stage path so revenue stays consistent), which is why
  // the UI confirms first and offers an optional deal value.
  setClient(leadId: string, isClient: boolean, dealValue?: number | null) {
    return authedRequest<LeadDetailsPatch>(`/api/leads/${leadId}/details`, {
      method: "PATCH",
      body: JSON.stringify({
        is_client: isClient,
        ...(isClient && dealValue != null ? { deal_value: dealValue } : {}),
      }),
    });
  },
  updateStage(leadId: string, stage: string, dealValue?: number, note?: string) {
    const body: Record<string, unknown> = { stage };
    if (dealValue != null) body.deal_value = dealValue;
    if (note) body.note = note;
    return authedRequest<{
      id: string;
      pipeline_stage: string;
      deal_value: number | null;
      list_price: number | null;
      discount_pct: number | null;
    }>(
      `/api/leads/${leadId}/stage`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      }
    );
  },
  // phone is REQUIRED: it is the lead's identity, the only thing the
  // duplicate rule can key on, and the only thing a later recording can
  // attach to. The backend rejects a create without it.
  createLead(input: {
    name: string;
    phone: string;
    reason?: string;
    source?: string;
    assigned_to?: string;
  }) {
    return authedRequest<{
      contact_key: string;
      name: string;
      status: string;
      display_id: string;
      created: boolean;
      // True when the number matched an ARCHIVED lead, which is revived in
      // place rather than duplicated — worth telling the founder, since the
      // lead comes back carrying its old call history.
      restored: boolean;
    }>("/api/leads", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  archived() {
    return authedRequest<{ leads: ArchivedLead[] }>("/api/leads/archived");
  },
  // Archive by default; permanent === true physically deletes the row. Call
  // recordings and AI analysis survive either way — they belong to the call
  // history, not the pipeline entry.
  remove(leadId: string, permanent = false) {
    return authedRequest<{
      id: string;
      deleted: boolean;
      permanent: boolean;
      message: string;
    }>(`/api/leads/${leadId}${permanent ? "?permanent=true" : ""}`, { method: "DELETE" });
  },
  restore(leadId: string) {
    return authedRequest<{
      id: string;
      restored: boolean;
      pipeline_stage?: string;
      assigned_to?: string | null;
      message: string;
    }>(`/api/leads/${leadId}/restore`, { method: "POST" });
  },
  updateDetails(
    leadId: string,
    input: Partial<{
      name: string;
      phone: string | null;
      reason: string | null;
      source: string | null;
      assigned_to: string;
      deal_value: number | null;
    }>
  ) {
    return authedRequest<{
      id: string;
      name: string;
      phone: string | null;
      reason: string | null;
      source: string | null;
      pipeline_stage: string;
      deal_value: number | null;
      telecaller_name: string | null;
    }>(`/api/leads/${leadId}/details`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },
};

// Six dimensions, not five — quality is a /110 composite (5 x 20 + punctuality x 10).
export type ScoreDimensions = {
  opening: number;
  discovery: number;
  pitch: number;
  objection_handling: number;
  closing: number;
  punctuality: number;
};

export type TelecallerMetrics = {
  calls: number;
  connected: number;
  closed_won: number;
  revenue: number;
  connect_pct: number;
  positive_pct: number;
  close_pct: number;
  talk_time_seconds: number;
  quality: number;
  dimensions: ScoreDimensions;
};

export type TelecallerPerformance = TelecallerMetrics & {
  id: string;
  name: string;
  trend: "up" | "down" | null;
};

export type TelecallerPerformanceResponse = {
  telecallers: TelecallerPerformance[];
  team_average: TelecallerMetrics;
};

export type TelecallerCallSummary = {
  call_id: string;
  timestamp: string | null;
  lead_verdict: string | null;
  total_score: number | null;
};

/** One call as every list on the Telecaller Detail page renders it.
 *
 *  Call Log / Best Calls / Needs Review and the paginated call-log page all
 *  use this ONE shape (the backend has a test pinning them together), so a
 *  call can't describe itself differently depending on which tab you found it
 *  in. */
export type TelecallerCallRow = {
  call_id: string;
  timestamp: string | null;
  /** "MM:SS", derived from the last transcript turn — absent when a call has
   *  no transcript. */
  duration_label: string | null;
  /** Null when the call landed before a Lead row existed; `lead_name` then
   *  falls back to the contact key. */
  lead_id: string | null;
  lead_name: string;
  phone: string | null;
  lead_verdict: string | null;
  /** The telecaller's handling score for this call, not the lead's quality.
   *  Null while the call is unanalysed. */
  total_score: number | null;
  has_audio: boolean;
  capture_source: string | null;
};

export type DailyCallCount = { date: string; count: number };

export type AssignedLead = {
  id: string;
  name: string;
  pipeline_stage: string;
  deal_value: number | null;
  phone: string | null;
  source: string | null;
  reason: string | null;
  created_at: string | null;
  /** Days since anything last changed on the lead. */
  days_stuck: number;
  /** The most recent call with this lead, or null when nobody has called yet
   *  — which is the actionable state, so it's rendered rather than hidden. */
  last_call: TelecallerCallRow | null;
};

export type TelecallerPerformanceDetail = TelecallerPerformance & {
  status: TeamHealthStatus;
  idle_minutes: number | null;
  best_calls: TelecallerCallRow[];
  needs_review: TelecallerCallRow[];
  timeline: TelecallerCallRow[];
  daily_calls: DailyCallCount[];
  leads_assigned: AssignedLead[];
};

/** The paginated call-log page uses the same row as the detail page's tabs. */
export type TelecallerCallLogEntry = TelecallerCallRow;

export type TelecallerCallLogResponse = {
  calls: TelecallerCallLogEntry[];
  total: number;
  skip: number;
  limit: number;
};

export type TeamHealthStatus = "Active" | "Break" | "Inactive" | "Absent";

export type TeamHealthEntry = {
  id: string;
  name: string;
  status: TeamHealthStatus;
  calls: number;
  connected: number;
  /** All-time: every lead of theirs currently in Closed Won. */
  closed_won: number;
  /** Just today — pairs with `revenue_today`, which comes off the same rows. */
  closed_today: number;
  quality: number;
  trend: "up" | "down" | null;
  revenue_today: number;
  leads_assigned: number;
  last_call_at: string | null;
  idle_minutes: number | null;
};

export type TeamHealthResponse = {
  telecallers: TeamHealthEntry[];
};

export const telecallersApi = {
  performance(range?: { start: string; end: string }) {
    const qs = range ? `?start=${range.start}&end=${range.end}` : "";
    return authedRequest<TelecallerPerformanceResponse>(`/api/telecallers/performance${qs}`);
  },
  performanceDetail(telecallerId: string, range?: { start: string; end: string }) {
    const qs = range ? `?start=${range.start}&end=${range.end}` : "";
    return authedRequest<TelecallerPerformanceDetail>(`/api/telecallers/performance/${telecallerId}${qs}`);
  },
  callLog(telecallerId: string, opts?: { start?: string; end?: string; skip?: number; limit?: number }) {
    const params = new URLSearchParams();
    if (opts?.start) params.set("start", opts.start);
    if (opts?.end) params.set("end", opts.end);
    if (opts?.skip) params.set("skip", String(opts.skip));
    if (opts?.limit) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return authedRequest<TelecallerCallLogResponse>(`/api/telecallers/performance/${telecallerId}/calls${qs ? `?${qs}` : ""}`);
  },
  status() {
    return authedRequest<TeamHealthResponse>("/api/telecallers/status");
  },
};

export type DashboardSnapshot = {
  leads_today: number;
  calls_today: number;
  hot_leads: number;
  conversion_rate_pct: number;
  total_leads: number;
  ranged?: boolean;
};

export type RevenuePoint = { date: string; day: number; revenue: number };

export type DashboardRevenue = {
  range_days: number;
  series: RevenuePoint[];
  mtd_total: number;
  avg_per_day: number;
  best_day: RevenuePoint | null;
  pct_change_vs_last_month: number | null;
  target_per_day: number | null;
  working_days_elapsed: number;
  days_in_month: number;
  on_target_days: number | null;
  off_target_days: number | null;
};

export type DashboardGoal = {
  monthly_target: number | null;
  mtd_revenue: number;
  pct_of_target: number | null;
  days_left: number;
  needed_per_day: number | null;
  deals_closed: number;
  avg_deal_value: number | null;
};

export type ActivityEventType = "success" | "warning" | "info" | "danger";

export type ActivityEvent = {
  id: string;
  type: ActivityEventType;
  time: string;
  title: string;
  detail: string;
  cta: string;
};

export const dashboardApi = {
  snapshot(range?: { start: string; end: string }) {
    const qs = range ? `?start=${range.start}&end=${range.end}` : "";
    return authedRequest<DashboardSnapshot>(`/api/dashboard/snapshot${qs}`);
  },
  revenue(rangeDays: 1 | 7 | 30 | 90 = 30) {
    return authedRequest<DashboardRevenue>(`/api/dashboard/revenue?range=${rangeDays}`);
  },
  goal() {
    return authedRequest<DashboardGoal>("/api/dashboard/goal");
  },
  activity() {
    return authedRequest<{ events: ActivityEvent[] }>("/api/dashboard/activity");
  },
};

export type NotificationSeverity = "success" | "info" | "warning" | "danger";

export type FounderNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  entity_type: string | null;
  entity_id: string | null;
  actor_name: string | null;
  created_at: string | null;
  read_at: string | null;
};

export type NotificationsResponse = {
  notifications: FounderNotification[];
  unread_count: number;
};

export const notificationsApi = {
  list(params?: { unreadOnly?: boolean; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.unreadOnly) query.set("unread_only", "true");
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return authedRequest<NotificationsResponse>(`/api/notifications${qs ? `?${qs}` : ""}`);
  },
  markRead(notificationId: string) {
    return authedRequest<FounderNotification>(`/api/notifications/${notificationId}/read`, { method: "PATCH" });
  },
  markAllRead() {
    return authedRequest<{ marked_read: number }>("/api/notifications/read-all", { method: "POST" });
  },
};

export type SourceQualityRow = {
  source: string;
  total: number;
  junk_pct: number;
  positive_pct: number;
  close_pct: number;
};

export type LeadQuality = {
  verdict_breakdown: { Hot: number; Warm: number; Cold: number; Junk: number };
  source_breakdown: Record<string, number>;
  source_matrix: SourceQualityRow[];
  avg_bant_score: number | null;
};

export type ScoreBand = {
  label: string;
  count: number;
  pct_of_total: number;
  close_rate_pct: number;
};

export type ScoreDistribution = {
  bands: ScoreBand[];
};

export type AgeingLead = {
  id: string;
  name: string;
  source: string | null;
  pipeline_stage: string;
  days_stuck: number;
  bucket: "0-3" | "3-7" | "7+";
};

export type LeadAgeing = {
  summary: { "0-3": number; "3-7": number; "7+": number };
  leads: AgeingLead[];
};

export type WastedLead = {
  id: string;
  name: string;
  source: string | null;
  days_since_created: number;
  pipeline_stage: string;
};

export type LeadWastage = {
  leads: WastedLead[];
  total_wasted: number;
  // The org's configured `wastage_days`. Mirrors ZombieLeads.threshold_days —
  // render this rather than hardcoding a cutoff the server doesn't agree with.
  threshold_days: number;
};

export type ZombieLead = {
  id: string;
  name: string;
  pipeline_stage: string;
  days_stalled: number;
  telecaller_name: string | null;
};

export type ZombieLeads = {
  leads: ZombieLead[];
  threshold_days: number;
};

export const leadsQualityApi = {
  quality() {
    return authedRequest<LeadQuality>("/api/leads/quality");
  },
  wastage() {
    return authedRequest<LeadWastage>("/api/leads/wastage");
  },
  zombie() {
    return authedRequest<ZombieLeads>("/api/leads/zombie");
  },
  scoreDistribution() {
    return authedRequest<ScoreDistribution>("/api/leads/score-distribution");
  },
  ageing() {
    return authedRequest<LeadAgeing>("/api/leads/ageing");
  },
};

export type AttendanceStatus = "completed" | "on_shift" | "auto_closed";

export type AttendanceRecord = {
  id: string;
  user_id: string;
  telecaller_name: string | null;
  date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  effective_check_out_at: string | null;
  hours_worked: number | null;
  status: AttendanceStatus;
};

export type AttendanceResponse = {
  records: AttendanceRecord[];
};

export const attendanceApi = {
  list(params?: { from_date?: string; to_date?: string; telecaller_id?: string }) {
    const query = new URLSearchParams();
    if (params?.from_date) query.set("from_date", params.from_date);
    if (params?.to_date) query.set("to_date", params.to_date);
    if (params?.telecaller_id) query.set("telecaller_id", params.telecaller_id);
    const qs = query.toString();
    return authedRequest<AttendanceResponse>(`/api/attendance${qs ? `?${qs}` : ""}`);
  },
  // Founder correction: set the real check-out time on a record (ISO string).
  correct(recordId: string, checkOutAt: string) {
    return authedRequest<AttendanceRecord>(`/api/attendance/${recordId}`, {
      method: "PATCH",
      body: JSON.stringify({ check_out_at: checkOutAt }),
    });
  },
};

export type InsightSeverity = "high" | "medium" | "low";
export type InsightCategory = "wastage" | "zombie" | "performance" | "quality";

export type Insight = {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  description: string;
};

export type InsightsResponse = {
  insights: Insight[];
};

export const insightsApi = {
  list() {
    return authedRequest<InsightsResponse>("/api/insights");
  },
};

export type ReportType = "weekly_summary" | "telecaller_performance" | "lead_quality" | "leakage";

export type ReportPreview<T = unknown> = {
  report_type: ReportType;
  generated_at: string;
  data: T;
};

export const reportsApi = {
  preview(reportType: ReportType) {
    return authedRequest<ReportPreview>(`/api/reports/preview?report_type=${reportType}`);
  },
};

// `trend` is a POINT DELTA vs this contact's previous call, not a direction
// string — see score_trend() in app/utils/lead_intelligence.py, which returns
// Optional[int]. It was typed "up" | "down" here, so every `trend === "up"`
// check was dead code and the arrows never rendered. null = no prior call.
export type ScoreRing = { value: number; max: number; trend: number | null };

export type ScoreEvidence = { turn: number; t: string; speaker: string; text: string };

export type ScoreDimension = {
  key: string;
  label: string;
  score: number;
  max: number;
  note: string;
  evidence: ScoreEvidence[];
  status: string;
};

export type ScriptComplianceEntry = {
  step: string;
  status: "followed" | "too_early" | "too_late" | "skipped";
  note: string;
};

export type SentimentTimelineSegment = {
  index: number;
  t0_sec: number;
  t1_sec: number;
  t0: string;
  label: string;
  avg_score: number;
};

export type CallScore = {
  call_id: string;
  call_score: number;
  rings: {
    overall: ScoreRing;
    telecaller: ScoreRing;
    lead_quality: ScoreRing;
    sentiment: ScoreRing;
  };
  verdict: string | null;
  relevance_reason: string | null;
  transcript_quality: string;
  breakdown: ScoreDimension[];
  script_compliance: ScriptComplianceEntry[];
  strengths: string[];
  improvements: string[];
  sentiment_timeline: { segments: SentimentTimelineSegment[]; caption: string };
  // "failed" means the numbers below are the zeroed placeholder the backend
  // persists when analysis errored (app/api/calls.py) — NOT a real 0/100.
  // Render greyed bars plus a retry banner, never a legitimate score.
  analysis_status: string | null;
  analysis_error: string | null;
};

export type ProcessingStageKey = "upload" | "transcribe" | "analyse" | "done";
export type ProcessingStageStatus = "done" | "active" | "pending" | "failed";

export type ProcessingStage = {
  key: ProcessingStageKey;
  label: string;
  status: ProcessingStageStatus;
};

export type ProcessingStatus = {
  call_id: string;
  current_stage: ProcessingStageKey;
  percent: number;
  failed: boolean;
  error: string | null;
  stages: ProcessingStage[];
};

export type CallSummary = {
  headline: string;
  key_moments: string[];
  objections_raised: string[];
  commitments_made: string[];
  overall_tone: string;
};

export type LeadAnalysisDetail = {
  call_id: string;
  status: string;
  bant_score: number | null;
  lead_verdict: string | null;
  lead_verdict_reason: string | null;
  relevance_reason: string | null;
  call_summary: CallSummary | null;
  key_points: string[];
  next_action: { recommended_action: string; channel: string; urgency: string } | null;
};

export type ChatWithCallResponse = {
  call_id: string;
  question: string;
  answer: string;
};

export type MemoryFact = {
  category?: string;
  text: string;
  call_index?: number;
  confidence?: string;
};

export type MemoryBubble = {
  contact_key: string;
  total_calls: number | null;
  last_call_id: string | null;
  last_call_at: string | null;
  facts: MemoryFact[];
  cumulative_bant: Record<string, { score?: number; note?: string }>;
  running_verdict: string | null;
  sentiment_trend: string | null;
  open_objections: string[];
  pending_commitments: string[];
  next_call_strategy: string | null;
  headline: string | null;
  updated_at: string | null;
};

export type CallHeader = {
  call_id: string;
  lead_id: string | null;
  lead_name: string;
  telecaller_name: string | null;
  timestamp: string | null;
  duration_label: string | null; // "MM:SS", derived from the transcript's last turn
};

export type TranscriptTurn = {
  role: "AGENT" | "USER";
  content: string;
  content_translated?: string;
  timestamp: string; // "MM:SS"
};

// `transcript` is never null — the backend returns {} (no `turns` key) for a
// call that hasn't been transcribed yet. Check `transcript?.turns?.length`.
export type TranscriptResponse = { call_id: string; transcript: { turns?: TranscriptTurn[] } | null };

export type TranslatedTranscriptResponse = {
  call_id: string;
  source_lang: string;
  source_lang_name?: string;
  target_lang: string;
  already_in_target: boolean;
  turns: TranscriptTurn[];
};

export const callsApi = {
  header(callId: string) {
    return authedRequest<CallHeader>(`/api/calls/${callId}/header`);
  },
  score(callId: string) {
    return authedRequest<CallScore>(`/api/calls/${callId}/score`);
  },
  // Upload → Transcribe → Analyse → Done. Poll this while a call's pipeline is
  // still running so the UI can show progress instead of the raw 404 that
  // /score and /lead-analysis return until analysis completes.
  processingStatus(callId: string) {
    return authedRequest<ProcessingStatus>(`/api/calls/${callId}/processing-status`);
  },
  transcript(callId: string) {
    return authedRequest<TranscriptResponse>(`/api/calls/${callId}/transcript`);
  },
  translateTranscript(callId: string, target = "en") {
    return authedRequest<TranslatedTranscriptResponse>(`/api/calls/${callId}/transcript/translate?target=${target}`);
  },
  // Contact's cumulative memory bubble, addressed by a call_id (the backend
  // derives the contact_key). Returns 404 when the contact has no bubble yet.
  memory(callId: string) {
    return authedRequest<MemoryBubble>(`/api/calls/${callId}/memory`);
  },
  // Recompute the contact's bubble from all their analysed calls. Returns the
  // fresh bubble; 404 if the contact has no analysed calls to build from.
  rebuildMemory(callId: string) {
    return authedRequest<MemoryBubble>(`/api/calls/${callId}/memory/rebuild`, {
      method: "POST",
    });
  },
  leadAnalysis(callId: string) {
    return authedRequest<LeadAnalysisDetail>(`/api/calls/${callId}/lead-analysis`);
  },
  chat(callId: string, question: string) {
    return authedRequest<ChatWithCallResponse>(`/api/calls/${callId}/chat`, {
      method: "POST",
      body: JSON.stringify({ question }),
    });
  },
  // Audio needs a Bearer header the browser's <audio src="..."> can't attach on
  // its own — fetch the bytes ourselves and hand the page an object URL.
  async fetchAudioBlob(callId: string): Promise<Blob> {
    const token = getToken();
    if (!token) throw new ApiError(401, "Not signed in");
    const res = await fetch(`${API_URL}/api/calls/${callId}/audio`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new ApiError(res.status, "Failed to load call audio");
    return res.blob();
  },
};

export type CoachingRecommendation = {
  telecaller_id: string;
  telecaller_name: string;
  issue: string;
  recommended_action: string;
  priority: "High" | "Medium" | "Low";
};

export type CoachingQueue = {
  queue: CoachingRecommendation[];
};

export const coachingApi = {
  queue() {
    return authedRequest<CoachingQueue>("/api/coaching/queue");
  },
};
