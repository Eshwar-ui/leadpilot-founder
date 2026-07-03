export const org = {
  name: "Prestige Estates Advisory",
  date: "Tue, 23 Jun 2026",
};

const RAW_REVENUE = [
  72, 65, 78, 88, 108, 0, 92, 98, 82, 74, 112, 0, 90, 95, 88, 78, 106, 0, 118,
  108, 96, 122, 118, 105, 0, 96, 108, 0, 121, 88,
];

export const revenueSeries = RAW_REVENUE.map((v, i) => ({
  day: i + 1,
  revenue: v * 1000,
}));

export const weeklyRevenue = [
  { week: "18-May", actual: 62, projected: 58 },
  { week: "25-May", actual: 70, projected: 64 },
  { week: "1-Jun", actual: 74, projected: 70 },
  { week: "8-Jun", actual: 78, projected: 74 },
  { week: "15-Jun", actual: 66, projected: 78 },
  { week: "22-Jun", actual: 82, projected: 80 },
];

export type Telecaller = {
  id: string;
  initials: string;
  name: string;
  languages: string;
  joined: string;
  tenure: string;
  team: string;
  calls: number;
  connectPct: number;
  positivePct: number;
  closePct: number;
  talkTime: string;
  quality: number;
  revenue: number;
  trend: "up" | "down";
  followUp: number;
  scriptCompliance: number;
  skills: { opening: number; product: number; objection: number; closing: number; ei: number; followUp: number };
};

export const telecallers: Telecaller[] = [
  {
    id: "arjun-rao",
    initials: "AR",
    name: "Arjun Rao",
    languages: "Kannada · English",
    joined: "Jan 2024",
    tenure: "2y 5m",
    team: "Inbound A",
    calls: 312,
    connectPct: 89.4,
    positivePct: 29.2,
    closePct: 12.8,
    talkTime: "4m 20s",
    quality: 86,
    revenue: 540000,
    trend: "up",
    followUp: 78,
    scriptCompliance: 92,
    skills: { opening: 88, product: 91, objection: 79, closing: 94, ei: 85, followUp: 78 },
  },
  {
    id: "vikram-shah",
    initials: "VS",
    name: "Vikram Shah",
    languages: "Gujarati · English",
    joined: "Mar 2023",
    tenure: "3y 3m",
    team: "Inbound A",
    calls: 286,
    connectPct: 86.1,
    positivePct: 27,
    closePct: 10.5,
    talkTime: "3m 58s",
    quality: 82,
    revenue: 430000,
    trend: "up",
    followUp: 80,
    scriptCompliance: 88,
    skills: { opening: 82, product: 85, objection: 80, closing: 84, ei: 79, followUp: 80 },
  },
  {
    id: "priya-nair",
    initials: "PN",
    name: "Priya Nair",
    languages: "Malayalam · English",
    joined: "Jun 2024",
    tenure: "1y 0m",
    team: "Inbound B",
    calls: 264,
    connectPct: 82.6,
    positivePct: 25.4,
    closePct: 9.4,
    talkTime: "5m 12s",
    quality: 78,
    revenue: 370000,
    trend: "up",
    followUp: 78,
    scriptCompliance: 84,
    skills: { opening: 68, product: 74, objection: 62, closing: 77, ei: 80, followUp: 83 },
  },
  {
    id: "lakshmi-iyer",
    initials: "LI",
    name: "Lakshmi Iyer",
    languages: "Tamil · English",
    joined: "Sep 2024",
    tenure: "9m",
    team: "Inbound B",
    calls: 218,
    connectPct: 76.1,
    positivePct: 20.1,
    closePct: 7.8,
    talkTime: "4m 44s",
    quality: 74,
    revenue: 250000,
    trend: "up",
    followUp: 71,
    scriptCompliance: 81,
    skills: { opening: 70, product: 72, objection: 60, closing: 75, ei: 77, followUp: 71 },
  },
  {
    id: "rohan-mehta",
    initials: "RM",
    name: "Rohan Mehta",
    languages: "Hindi · English",
    joined: "Nov 2023",
    tenure: "2y 7m",
    team: "Outbound A",
    calls: 240,
    connectPct: 79.2,
    positivePct: 22.8,
    closePct: 8.3,
    talkTime: "4m 04s",
    quality: 70,
    revenue: 280000,
    trend: "up",
    followUp: 69,
    scriptCompliance: 80,
    skills: { opening: 71, product: 68, objection: 66, closing: 72, ei: 70, followUp: 69 },
  },
  {
    id: "sana-khan",
    initials: "SK",
    name: "Sana Khan",
    languages: "Urdu · English",
    joined: "Jan 2025",
    tenure: "5m",
    team: "Outbound A",
    calls: 198,
    connectPct: 68.7,
    positivePct: 16.7,
    closePct: 5.1,
    talkTime: "3m 22s",
    quality: 54,
    revenue: 140000,
    trend: "down",
    followUp: 48,
    scriptCompliance: 66,
    skills: { opening: 58, product: 55, objection: 42, closing: 50, ei: 60, followUp: 48 },
  },
];

export const teamAvg = {
  calls: 253,
  connectPct: 80.3,
  positivePct: 23.5,
  closePct: 9.0,
  talkTime: "4m 11s",
  quality: 74,
  revenue: 330000,
};

export const attendance = [
  { id: "arjun-rao", name: "Arjun Rao", login: "09:01", firstCall: "09:07", breaks: "42 min", active: "5h 12m", idle: "42m", status: "ok" as const },
  { id: "vikram-shah", name: "Vikram Shah", login: "08:55", firstCall: "09:03", breaks: "28 min", active: "4h 48m", idle: "28m", status: "ok" as const },
  { id: "priya-nair", name: "Priya Nair", login: "09:12", firstCall: "09:21", breaks: "55 min", active: "4h 22m", idle: "1h 08m", status: "warn" as const, pattern: "3d pattern" },
  { id: "rohan-mehta", name: "Rohan Mehta", login: "09:08", firstCall: "09:18", breaks: "34 min", active: "5h 01m", idle: "59m", status: "ok" as const },
  { id: "lakshmi-iyer", name: "Lakshmi Iyer", login: "09:32", firstCall: "09:41", breaks: "1h 20m", active: "3h 28m", idle: "2h 02m", status: "warn" as const, pattern: "4d pattern" },
  { id: "sana-khan", name: "Sana Khan", login: "08:48", firstCall: "08:54", breaks: "18 min", active: "6h 02m", idle: "18m", status: "ok" as const },
];

export type KanbanLead = {
  id: string;
  name: string;
  source: "Meta" | "Google" | "Walk-in" | "Referral";
  score: number;
  telecaller: string;
  daysStuck: number;
  freshLabel: string;
  revenue: number;
  stage: string;
};

export const kanbanStages = [
  "New",
  "Assigned",
  "Contacted",
  "Interested",
  "Proposal Sent",
  "Negotiation",
  "Closed Won",
  "Closed Lost",
  "Junk",
];

export const kanbanLeads: KanbanLead[] = [
  { id: "1", name: "Rajesh Kumar", source: "Meta", score: 84, telecaller: "AR", freshLabel: "Fresh", daysStuck: 0, revenue: 820000, stage: "New" },
  { id: "2", name: "Geeta Sharma", source: "Google", score: 82, telecaller: "RM", freshLabel: "Fresh", daysStuck: 0, revenue: 880000, stage: "New" },
  { id: "3", name: "Anitha Raj", source: "Google", score: 72, telecaller: "PN", freshLabel: "1d stuck", daysStuck: 1, revenue: 720000, stage: "Assigned" },
  { id: "4", name: "Ravi Pillai", source: "Google", score: 55, telecaller: "VS", freshLabel: "2d stuck", daysStuck: 2, revenue: 640000, stage: "Assigned" },
  { id: "5", name: "Divya Menon", source: "Meta", score: 54, telecaller: "SK", freshLabel: "5d stuck", daysStuck: 5, revenue: 650000, stage: "Contacted" },
  { id: "6", name: "Mohan Das", source: "Meta", score: 61, telecaller: "AR", freshLabel: "4d stuck", daysStuck: 4, revenue: 580000, stage: "Contacted" },
  { id: "7", name: "Kiran Reddy", source: "Google", score: 76, telecaller: "VS", freshLabel: "2d stuck", daysStuck: 2, revenue: 780000, stage: "Interested" },
  { id: "8", name: "Vijay Kumar", source: "Meta", score: 67, telecaller: "LI", freshLabel: "8d stuck", daysStuck: 8, revenue: 690000, stage: "Interested" },
  { id: "9", name: "Suresh Nair", source: "Walk-in", score: 88, telecaller: "LI", freshLabel: "7d stuck", daysStuck: 7, revenue: 1200000, stage: "Proposal Sent" },
  { id: "10", name: "Sita Devi", source: "Walk-in", score: 79, telecaller: "AR", freshLabel: "3d stuck", daysStuck: 3, revenue: 810000, stage: "Proposal Sent" },
  { id: "11", name: "Meena Iyer", source: "Google", score: 91, telecaller: "PN", freshLabel: "3d stuck", daysStuck: 3, revenue: 1100000, stage: "Negotiation" },
  { id: "12", name: "Lakshmi K.", source: "Referral", score: 94, telecaller: "VS", freshLabel: "2d stuck", daysStuck: 2, revenue: 1050000, stage: "Negotiation" },
  { id: "13", name: "Arjun Shah", source: "Referral", score: 96, telecaller: "AR", freshLabel: "Fresh", daysStuck: 0, revenue: 950000, stage: "Closed Won" },
  { id: "14", name: "Ramesh Iyer", source: "Meta", score: 38, telecaller: "SK", freshLabel: "", daysStuck: 0, revenue: 0, stage: "Closed Lost" },
];

export const leadQualitySources = [
  { source: "Referral", leads: 48, junkPct: 2.1, positivePct: 54.2, closePct: 29.2, cpl: "Free" },
  { source: "Walk-in", leads: 36, junkPct: 2.8, positivePct: 50.0, closePct: 25.0, cpl: "Free" },
  { source: "Google Search", leads: 68, junkPct: 7.4, positivePct: 47.1, closePct: 20.6, cpl: "₹1,500" },
  { source: "Google PMax", leads: 94, junkPct: 8.5, positivePct: 36.2, closePct: 14.9, cpl: "₹920" },
  { source: "Meta Lead Gen", leads: 542, junkPct: 23.1, positivePct: 24.7, closePct: 7.4, cpl: "₹180" },
  { source: "Meta Retarget", leads: 187, junkPct: 24.6, positivePct: 21.4, closePct: 5.9, cpl: "₹278" },
];

export const scoreDistribution = [
  { band: "81–100", leads: 68, closePct: 22.4, revenue: "₹18.2L", tone: "success" as const },
  { band: "61–80", leads: 184, closePct: 14.2, revenue: "₹29.6L", tone: "info" as const },
  { band: "41–60", leads: 271, closePct: 8.1, revenue: "₹21.8L", tone: "warning" as const },
  { band: "21–40", leads: 198, closePct: 3.2, revenue: "₹8.2L", tone: "danger" as const },
  { band: "0–20", leads: 119, closePct: 0.8, revenue: "₹0.9L", tone: "neutral" as const },
];

export const teamMembers = [
  { name: "Arjun Rao", email: "arjun.rao@prestige.com", role: "TELECALLER", status: "Active", calls: 42, leads: 12, quality: 94, lastActive: "Active Now" },
  { name: "Priya Nair", email: "p.nair@prestige.com", role: "TELECALLER", status: "Active", calls: 38, leads: 8, quality: 88, lastActive: "12m ago" },
  { name: "Vikram Shah", email: "vikram@prestige.com", role: "TELECALLER", status: "Active", calls: 51, leads: 15, quality: 91, lastActive: "Active Now" },
  { name: "Sneha Pillai", email: "sneha.p@prestige.com", role: "TELECALLER", status: "Inactive", calls: 0, leads: 0, quality: 82, lastActive: "2d ago" },
  { name: "Rohit Mehra", email: "rohit.m@prestige.com", role: "TELECALLER", status: "Active", calls: 44, leads: 10, quality: 87, lastActive: "Active Now" },
  { name: "Ananya Gupta", email: "ananya.g@prestige.com", role: "AD MANAGER", status: "Active", calls: 12, leads: 45, quality: 96, lastActive: "Active Now" },
  { name: "Karan Bajaj", email: "karan.b@prestige.com", role: "AD MANAGER", status: "Active", calls: 8, leads: 32, quality: 93, lastActive: "5m ago" },
  { name: "Deepa Krishnan", email: "deepa.k@prestige.com", role: "ADMIN", status: "Active", calls: 4, leads: 5, quality: 98, lastActive: "Active Now" },
];

export const campaigns = [
  { name: "Meta Lead Gen — 3BHK", platform: "Meta", budgetDay: 8000, spent: 9760, leads: 542, cpl: 180, cpc: 62, roas: 3.4, status: "Overspend" as const, pct: 122 },
  { name: "Google Search — NRI", platform: "Google", budgetDay: 12000, spent: 10200, leads: 68, cpl: 1500, cpc: 340, roas: 5.8, status: "OK" as const, pct: 85 },
  { name: "Google PMax — Plots", platform: "Google", budgetDay: 9000, spent: 8640, leads: 94, cpl: 920, cpc: 185, roas: 4.1, status: "OK" as const, pct: 96 },
  { name: "Meta Retargeting", platform: "Meta", budgetDay: 5000, spent: 0, leads: 0, cpl: 0, cpc: 0, roas: 0, status: "Paused" as const, pct: 0 },
  { name: "Meta Lookalike — EMI", platform: "Meta", budgetDay: 6000, spent: 5760, leads: 310, cpl: 186, cpc: 64, roas: 2.6, status: "OK" as const, pct: 96 },
];

export const leadWastage = [
  { source: "Meta Lead Gen", leadsIn: 542, neverCalled: 124, wastedPct: 22.9, revenueLoss: "₹1.9L" },
  { source: "Google PMax", leadsIn: 94, neverCalled: 8, wastedPct: 8.5, revenueLoss: "₹0.7L" },
  { source: "Internal Referral", leadsIn: 48, neverCalled: 2, wastedPct: 4.2, revenueLoss: "₹0.1L" },
  { source: "Portal Walk-in", leadsIn: 36, neverCalled: 6, wastedPct: 16.7, revenueLoss: "₹0.5L" },
];

export const zombieLeads = [
  { name: "Hemant Soni", source: "Meta", calls: 8, days: 22, outcome: "No Answer" },
  { name: "Rashida Begum", source: "Meta", calls: 7, days: 18, outcome: "Negative" },
  { name: "Prakash Gupta", source: "Google", calls: 6, days: 15, outcome: "No Answer" },
  { name: "Nalini Sharma", source: "Walk-in", calls: 9, days: 28, outcome: "Negative" },
  { name: "Faisal Khan", source: "Meta", calls: 7, days: 16, outcome: "No Answer" },
];

export const insights = [
  {
    category: "TELECALLER PERFORMANCE",
    severity: "HIGH" as const,
    text: "Priya's close rate dropped 18% over the past 7 days (8.2% → 6.9%). Root cause: she's assigned Meta Ads leads (close rate 4.1%) while her Referral leads close at 18%. Rebalancing her queue to referral-heavy leads could recover ₹80K this week.",
    action: "Rebalance Lead Assignments",
  },
  {
    category: "REVENUE AT RISK",
    severity: "CRITICAL" as const,
    text: "₹2.1L in qualified leads has been inactive for 5+ days. That is 8.5% of this month's target. Rahul Mehta and Lakshmi Iyer are currently underutilised and can absorb these leads immediately.",
    action: "View Stale Leads → Assign Now",
  },
  {
    category: "QUICK WIN",
    severity: "HIGH" as const,
    text: "9 leads in Negotiation stage with score >80 have not been called in 48 hours. These are the highest-probability closures in the funnel right now. Calling all 9 today could yield 3–4 deals (~₹2.5L).",
    action: "View Call List",
  },
  {
    category: "CAMPAIGN EFFICIENCY",
    severity: "MEDIUM" as const,
    text: "Meta Lead Gen CPL increased 25% this week (₹180 → ₹225). The current creative has been running 22 days — audience fatigue is likely. Recommend refreshing 2–3 ad creatives and testing a new property angle.",
    action: "Review Campaign",
  },
  {
    category: "TEAM PATTERN",
    severity: "MEDIUM" as const,
    text: "Calls after 3 PM have 34% higher connection rates for Google Ads leads. Consider shifting Arjun and Vikram's Google lead queue to the afternoon slot — estimated uplift: 8–10 additional connects per day.",
    action: "Adjust Shift Schedule",
  },
];

export const liveActivity = [
  { time: "10:42", type: "success", title: "Deal Closed", detail: "Arjun Rao · ₹85,000 · Prestige NRI Heights", cta: "View" },
  { time: "10:38", type: "warning", title: "Telecaller Idle", detail: "Priya idle 52 min · 3 leads in queue", cta: "Review" },
  { time: "10:31", type: "info", title: "High-score Lead", detail: "Google Ads · Rajesh Kumar · Score 84", cta: "Assign" },
  { time: "10:18", type: "danger", title: "Budget Alert", detail: "Meta Lead Gen +20% over daily cap", cta: "Pause" },
];

export const reportTypes = [
  { key: "founder-weekly", name: "Founder Weekly", description: "Revenue, team health, top insights, leakage summary — 1 page" },
  { key: "telecaller-scorecard", name: "Telecaller Scorecard", description: "Per-agent quality score, call metrics, skill radar, coaching notes" },
  { key: "campaign-roi", name: "Campaign ROI Report", description: "Per-campaign spend, ROAS, true ROI, recommendations" },
  { key: "lead-quality-audit", name: "Lead Quality Audit", description: "Source matrix, score distribution, junk analysis, action plan" },
  { key: "leakage-report", name: "Leakage Report", description: "All leakage sources, ₹ impact, fix status, recovered amount" },
  { key: "custom", name: "Custom Ad-hoc", description: "Pick any combination of sections and time range" },
];
