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
    throw new ApiError(res.status, body?.detail ?? `Request failed (${res.status})`);
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
  update(userId: string, input: { role?: string; is_active?: boolean }) {
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
};

export type BoardLead = {
  id: string;
  name: string;
  source: string | null;
  score: number | null;
  pipeline_stage: string;
  telecaller_name: string | null;
  days_stuck: number;
};

export type LeadsBoard = {
  stages: string[];
  leads: BoardLead[];
};

export const leadsApi = {
  board() {
    return authedRequest<LeadsBoard>("/api/leads/board");
  },
  updateStage(leadId: string, stage: string, dealValue?: number) {
    return authedRequest<{ id: string; pipeline_stage: string; deal_value: number | null }>(
      `/api/leads/${leadId}/stage`,
      {
        method: "PATCH",
        body: JSON.stringify(dealValue != null ? { stage, deal_value: dealValue } : { stage }),
      }
    );
  },
  createLead(input: { name: string; phone?: string; reason?: string }) {
    return authedRequest<{ contact_key: string; name: string; status: string; created: boolean }>(
      "/api/leads",
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    );
  },
};

export type ScoreDimensions = {
  opening: number;
  discovery: number;
  pitch: number;
  objection_handling: number;
  closing: number;
};

export type TelecallerMetrics = {
  calls: number;
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
  timestamp: string;
  lead_verdict: string;
  total_score: number;
};

export type TelecallerTimelineEntry = {
  call_id: string;
  timestamp: string;
  lead_verdict: string;
};

export type TelecallerPerformanceDetail = TelecallerPerformance & {
  best_calls: TelecallerCallSummary[];
  needs_review: TelecallerCallSummary[];
  timeline: TelecallerTimelineEntry[];
};

export type TeamHealthStatus = "Active" | "Break" | "Inactive" | "Absent";

export type TeamHealthEntry = {
  id: string;
  name: string;
  status: TeamHealthStatus;
  calls: number;
  connected: number;
  closed_won: number;
  quality: number;
  trend: "up" | "down" | null;
  revenue_today: number;
};

export type TeamHealthResponse = {
  telecallers: TeamHealthEntry[];
};

export const telecallersApi = {
  performance() {
    return authedRequest<TelecallerPerformanceResponse>("/api/telecallers/performance");
  },
  performanceDetail(telecallerId: string) {
    return authedRequest<TelecallerPerformanceDetail>(`/api/telecallers/performance/${telecallerId}`);
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
  telecaller_name: string;
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

export type ReportType = "weekly_summary" | "telecaller_performance" | "lead_quality";

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

export type ScoreRing = { value: number; max: number; trend: "up" | "down" | null };

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

export const callsApi = {
  score(callId: string) {
    return authedRequest<CallScore>(`/api/calls/${callId}/score`);
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
