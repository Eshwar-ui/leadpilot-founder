import { getToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type AuthUser = {
  id: string;
  org_id: string;
  org_name: string;
  email: string;
  name: string;
  role: string;
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
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

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
  return request<T>(path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  });
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

export const telecallersApi = {
  performance() {
    return authedRequest<TelecallerPerformanceResponse>("/api/telecallers/performance");
  },
  performanceDetail(telecallerId: string) {
    return authedRequest<TelecallerPerformanceDetail>(`/api/telecallers/performance/${telecallerId}`);
  },
};

export type DashboardSnapshot = {
  leads_today: number;
  calls_today: number;
  hot_leads: number;
  conversion_rate_pct: number;
  total_leads: number;
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
  snapshot() {
    return authedRequest<DashboardSnapshot>("/api/dashboard/snapshot");
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

export type LeadQuality = {
  verdict_breakdown: { Hot: number; Warm: number; Cold: number; Junk: number };
  source_breakdown: Record<string, number>;
  avg_bant_score: number | null;
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
};

export type AttendanceRecord = {
  id: string;
  user_id: string;
  telecaller_name: string;
  date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  hours_worked: number | null;
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
