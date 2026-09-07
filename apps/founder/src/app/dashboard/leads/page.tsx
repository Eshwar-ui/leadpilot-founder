"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, BadgeCheck, ChevronDown, ChevronsUpDown, Search, Download, Plus, Archive, SlidersHorizontal, Upload, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { Button } from "@/components/ui/Button";
import { CopyableId } from "@/components/ui/CopyableId";
import { SkeletonTableRow } from "@/components/ui/Skeleton";
import { AddLeadModal } from "@/components/leads/AddLeadModal";
import { ApiError, leadsApi, type BoardLead } from "@/lib/api";
import { cn, formatINR } from "@/lib/utils";

const STAGE_ORDER = [
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

const stagePill: Record<string, string> = {
  New: "bg-blue-50 text-blue-700",
  Assigned: "bg-slate-100 text-slate-600",
  Contacted: "bg-slate-100 text-slate-600",
  Interested: "bg-blue-50 text-blue-700",
  "Proposal Sent": "bg-blue-50 text-blue-700",
  Negotiation: "bg-amber-50 text-amber-700",
  "Closed Won": "bg-emerald-50 text-emerald-700",
  "Closed Lost": "bg-red-50 text-red-700",
  Junk: "bg-slate-100 text-slate-400",
};

function freshLabel(daysStuck: number) {
  return daysStuck === 0 ? "Today" : `${daysStuck}d ago`;
}

const ALL = "All";
const ALL_OWNERS = "All owners";
const ALL_SOURCES = "All sources";

// Sentinel values for the two "the field is empty" dropdown options. They're
// wrapped in double underscores so they can never collide with a real owner
// name or source string coming back from the API.
const UNASSIGNED = "__lp_unassigned__";
const NO_SOURCE = "__lp_no_source__";

// One shape for every filter band. Typing the arrays explicitly (rather than
// `as const`) is what lets the "all" entry declare `match: () => true` with no
// parameter: a function of fewer arguments is assignable to the wider
// signature, so `bands.find(...)!.match(x)` still type-checks.
type Band<T> = { key: string; label: string; match: (value: T) => boolean };

// Score bands. `null` (never scored) is its OWN option, never folded into the
// 0-40 band — the backend is explicit that a lead with no analysed call has no
// score rather than a zero one, and showing it as "Low" would rank a lead
// nobody has called yet alongside leads that were called and went badly.
const SCORE_BANDS: Band<number | null>[] = [
  { key: "all", label: "All scores", match: () => true },
  { key: "high", label: "High (71-100)", match: (s: number | null) => s !== null && s >= 71 },
  { key: "mid", label: "Medium (41-70)", match: (s: number | null) => s !== null && s >= 41 && s <= 70 },
  { key: "low", label: "Low (0-40)", match: (s: number | null) => s !== null && s <= 40 },
  { key: "unscored", label: "Not scored yet", match: (s: number | null) => s === null },
];

const VALUE_BANDS: Band<number | null>[] = [
  { key: "all", label: "All values", match: () => true },
  { key: "none", label: "No value set", match: (v: number | null) => v === null },
  { key: "lt50k", label: "Under ₹50,000", match: (v: number | null) => v !== null && v < 50_000 },
  { key: "mid", label: "₹50,000 - ₹2,00,000", match: (v: number | null) => v !== null && v >= 50_000 && v <= 200_000 },
  { key: "gt2l", label: "Above ₹2,00,000", match: (v: number | null) => v !== null && v > 200_000 },
];

// Keyed off `days_stuck`, which the board endpoint derives from
// updated_at ?? created_at — i.e. genuinely "last update", not "created".
const UPDATED_BANDS: Band<number>[] = [
  { key: "all", label: "Updated any time", match: () => true },
  { key: "today", label: "Updated today", match: (d: number) => d === 0 },
  { key: "7d", label: "Last 7 days", match: (d: number) => d <= 7 },
  { key: "30d", label: "Last 30 days", match: (d: number) => d <= 30 },
  { key: "stale", label: "Stale (30+ days)", match: (d: number) => d > 30 },
];

const ENQUIRY_BANDS: Band<string | null>[] = [
  { key: "all", label: "Any enquiry", match: () => true },
  { key: "has", label: "Has an enquiry", match: (r: string | null) => !!r && r.trim().length > 0 },
  { key: "none", label: "No enquiry noted", match: (r: string | null) => !r || r.trim().length === 0 },
];

type SortKey = "name" | "score" | "value" | "updated" | null;
type SortDir = "asc" | "desc";

const DEFAULTS = {
  q: "",
  stage: ALL,
  owner: ALL_OWNERS,
  source: ALL_SOURCES,
  score: "all",
  value: "all",
  updated: "all",
  enquiry: "all",
};

// Converted leads live on the Clients page. All Leads hides them by default so
// it reads as "what's still to win" — but they stay one toggle away rather
// than disappearing, because a client can still sit at an active stage and be
// mid-negotiation on a NEW deal. Hiding those outright would drop live work
// off the working list.
const SHOW_CLIENTS_PARAM = "clients";

function AllLeadsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [leads, setLeads] = useState<BoardLead[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters are seeded from the URL so a filtered view is shareable and the
  // browser back button restores it, rather than silently resetting to "All".
  const [query, setQuery] = useState(searchParams.get("q") ?? DEFAULTS.q);
  const [stage, setStage] = useState(searchParams.get("stage") ?? DEFAULTS.stage);
  const [owner, setOwner] = useState(searchParams.get("owner") ?? DEFAULTS.owner);
  const [source, setSource] = useState(searchParams.get("source") ?? DEFAULTS.source);
  const [scoreBand, setScoreBand] = useState(searchParams.get("score") ?? DEFAULTS.score);
  const [valueBand, setValueBand] = useState(searchParams.get("value") ?? DEFAULTS.value);
  const [updatedBand, setUpdatedBand] = useState(searchParams.get("updated") ?? DEFAULTS.updated);
  const [enquiryBand, setEnquiryBand] = useState(searchParams.get("enquiry") ?? DEFAULTS.enquiry);
  const [showClients, setShowClients] = useState(searchParams.get(SHOW_CLIENTS_PARAM) === "1");
  const [sortKey, setSortKey] = useState<SortKey>((searchParams.get("sort") as SortKey) ?? null);
  const [sortDir, setSortDir] = useState<SortDir>((searchParams.get("dir") as SortDir) ?? "desc");

  // Open on load when a shared URL already carries panel filters, so they're
  // never applied with no visible sign of where they came from. Computed here
  // rather than in an effect — an effect would render once shut, then again
  // open, for a value that is knowable up front.
  const [filtersOpen, setFiltersOpen] = useState(() =>
    ["owner", "source", "score", "value", "updated", "enquiry"].some((k) => searchParams.get(k))
  );
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    leadsApi
      .board()
      .then((res) => setLeads(res.leads))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load leads"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  // Mirror the active filters into the query string. `replace`, not `push`, so
  // tweaking a dropdown five times doesn't bury the previous page under five
  // history entries — but the URL still carries the full state for a reload
  // or a shared link.
  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (stage !== DEFAULTS.stage) params.set("stage", stage);
    if (owner !== DEFAULTS.owner) params.set("owner", owner);
    if (source !== DEFAULTS.source) params.set("source", source);
    if (scoreBand !== DEFAULTS.score) params.set("score", scoreBand);
    if (valueBand !== DEFAULTS.value) params.set("value", valueBand);
    if (updatedBand !== DEFAULTS.updated) params.set("updated", updatedBand);
    if (enquiryBand !== DEFAULTS.enquiry) params.set("enquiry", enquiryBand);
    if (showClients) params.set(SHOW_CLIENTS_PARAM, "1");
    if (sortKey) {
      params.set("sort", sortKey);
      params.set("dir", sortDir);
    }
    const qs = params.toString();
    router.replace(qs ? `/dashboard/leads?${qs}` : "/dashboard/leads", { scroll: false });
  }, [query, stage, owner, source, scoreBand, valueBand, updatedBand, enquiryBand, showClients, sortKey, sortDir, router]);

  // The working set: everything the founder can currently see. Clients drop
  // out here rather than in `filtered`, so the stage chip counts, the "Showing
  // X of Y" line and the table can never disagree about how many leads exist.
  const inScope = useMemo(
    () => (leads ?? []).filter((l) => showClients || !l.is_client),
    [leads, showClients]
  );

  const clientCount = useMemo(() => (leads ?? []).filter((l) => l.is_client).length, [leads]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of inScope) counts[l.pipeline_stage] = (counts[l.pipeline_stage] ?? 0) + 1;
    return counts;
  }, [inScope]);

  const owners = useMemo(
    () => Array.from(new Set(inScope.map((l) => l.telecaller_name).filter((n): n is string => !!n))).sort(),
    [inScope]
  );
  const sources = useMemo(
    () => Array.from(new Set(inScope.map((l) => l.source).filter((s): s is string => !!s))).sort(),
    [inScope]
  );
  const hasUnassigned = useMemo(() => inScope.some((l) => !l.telecaller_name), [inScope]);
  const hasSourceless = useMemo(() => inScope.some((l) => !l.source), [inScope]);

  const filtered = useMemo(() => {
    let out = inScope;
    if (stage !== ALL) out = out.filter((l) => l.pipeline_stage === stage);

    if (owner === UNASSIGNED) out = out.filter((l) => !l.telecaller_name);
    else if (owner !== ALL_OWNERS) out = out.filter((l) => l.telecaller_name === owner);

    if (source === NO_SOURCE) out = out.filter((l) => !l.source);
    else if (source !== ALL_SOURCES) out = out.filter((l) => l.source === source);

    const score = SCORE_BANDS.find((b) => b.key === scoreBand);
    if (score && score.key !== "all") out = out.filter((l) => score.match(l.score));

    const value = VALUE_BANDS.find((b) => b.key === valueBand);
    if (value && value.key !== "all") out = out.filter((l) => value.match(l.deal_value));

    const updated = UPDATED_BANDS.find((b) => b.key === updatedBand);
    if (updated && updated.key !== "all") out = out.filter((l) => updated.match(l.days_stuck));

    const enquiry = ENQUIRY_BANDS.find((b) => b.key === enquiryBand);
    if (enquiry && enquiry.key !== "all") out = out.filter((l) => enquiry.match(l.reason));

    const q = query.trim().toLowerCase();
    if (q) {
      out = out.filter((l) =>
        `${l.display_id} ${l.name} ${l.phone ?? ""} ${l.reason ?? ""} ${l.created_by_name ?? ""}`
          .toLowerCase()
          .includes(q)
      );
    }
    return out;
  }, [inScope, stage, owner, source, scoreBand, valueBand, updatedBand, enquiryBand, query]);

  const visible = useMemo(() => {
    if (!sortKey) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    // Nulls always sort last, in BOTH directions. A lead with no score isn't
    // the lowest-scoring lead and a lead with no deal value isn't the
    // cheapest — flipping the sort shouldn't parade the unknowns to the top.
    const nullsLast = (a: number | null, b: number | null) => {
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      return (a - b) * dir;
    };
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name) * dir;
        case "score":
          return nullsLast(a.score, b.score);
        case "value":
          return nullsLast(a.deal_value, b.deal_value);
        case "updated":
          // days_stuck counts UP as a lead goes stale, so "descending" on the
          // Last Update column means most-recently-touched first.
          return (b.days_stuck - a.days_stuck) * dir;
        default:
          return 0;
      }
    });
  }, [filtered, sortKey, sortDir]);

  const activeFilters = useMemo(() => {
    const chips: { label: string; clear: () => void }[] = [];
    if (query.trim()) chips.push({ label: `Search: "${query.trim()}"`, clear: () => setQuery("") });
    if (stage !== ALL) chips.push({ label: `Stage: ${stage}`, clear: () => setStage(ALL) });
    if (owner !== ALL_OWNERS)
      chips.push({
        label: `Owner: ${owner === UNASSIGNED ? "Unassigned" : owner}`,
        clear: () => setOwner(ALL_OWNERS),
      });
    if (source !== ALL_SOURCES)
      chips.push({
        label: `Source: ${source === NO_SOURCE ? "No source" : source}`,
        clear: () => setSource(ALL_SOURCES),
      });
    if (scoreBand !== "all")
      chips.push({
        label: SCORE_BANDS.find((b) => b.key === scoreBand)?.label ?? scoreBand,
        clear: () => setScoreBand("all"),
      });
    if (valueBand !== "all")
      chips.push({
        label: VALUE_BANDS.find((b) => b.key === valueBand)?.label ?? valueBand,
        clear: () => setValueBand("all"),
      });
    if (updatedBand !== "all")
      chips.push({
        label: UPDATED_BANDS.find((b) => b.key === updatedBand)?.label ?? updatedBand,
        clear: () => setUpdatedBand("all"),
      });
    if (enquiryBand !== "all")
      chips.push({
        label: ENQUIRY_BANDS.find((b) => b.key === enquiryBand)?.label ?? enquiryBand,
        clear: () => setEnquiryBand("all"),
      });
    return chips;
  }, [query, stage, owner, source, scoreBand, valueBand, updatedBand, enquiryBand]);

  // Only the panel's own controls. Search, stage and the clients toggle are
  // visible on the bar itself, so counting them here would make the badge
  // claim filters are "hidden" when they're in plain sight.
  const panelFilterCount = useMemo(
    () =>
      [
        owner !== DEFAULTS.owner,
        source !== DEFAULTS.source,
        scoreBand !== DEFAULTS.score,
        valueBand !== DEFAULTS.value,
        updatedBand !== DEFAULTS.updated,
        enquiryBand !== DEFAULTS.enquiry,
      ].filter(Boolean).length,
    [owner, source, scoreBand, valueBand, updatedBand, enquiryBand]
  );

  const filtering = activeFilters.length > 0;

  const clearFilters = useCallback(() => {
    setQuery(DEFAULTS.q);
    setStage(DEFAULTS.stage);
    setOwner(DEFAULTS.owner);
    setSource(DEFAULTS.source);
    setScoreBand(DEFAULTS.score);
    setValueBand(DEFAULTS.value);
    setUpdatedBand(DEFAULTS.updated);
    setEnquiryBand(DEFAULTS.enquiry);
  }, []);

  function toggleSort(key: Exclude<SortKey, null>) {
    if (sortKey === key) {
      // Third click clears the sort and returns to the API's own order,
      // rather than trapping the table in one of two sorted states.
      if (sortDir === "desc") setSortDir("asc");
      else {
        setSortKey(null);
        setSortDir("desc");
      }
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function exportCsv() {
    const header = ["Lead ID", "Name", "Phone", "Source", "Stage", "Client", "Score", "Value", "Owner", "Added By", "Added On", "Last Update"];
    const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const rows = visible.map((l) =>
      [
        l.display_id,
        l.name,
        l.phone ?? "",
        l.source ?? "",
        l.pipeline_stage,
        l.is_client ? "Yes" : "No",
        l.score ?? "",
        l.deal_value ?? "",
        l.telecaller_name ?? "",
        l.created_by_name ?? "",
        l.created_at ? new Date(l.created_at).toLocaleDateString() : "",
        `${l.days_stuck}d`,
      ]
        .map((c) => escape(String(c)))
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "all-leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="pb-10">
      <PageHeader
        title="All Leads"
        description={leads ? `${leads.length} leads in the pipeline` : undefined}
        action={
          <>
            <Link href="/dashboard/leads/archived">
              <Button variant="outline" size="sm">
                <Archive className="size-3.5" /> Archive
              </Button>
            </Link>
            <Link href="/dashboard/leads/quality">
              <Button variant="outline" size="sm">
                Lead Quality
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="size-3.5" /> Export
            </Button>
            <Link href="/dashboard/leads/import">
              <Button variant="outline" size="sm">
                <Upload className="size-3.5" /> Import
              </Button>
            </Link>
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-3.5" /> Add Lead
            </Button>
          </>
        }
      />

      <AddLeadModal
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(message) => {
          setNotice(message);
          load();
        }}
      />

      {notice && (
        <div
          role="status"
          className="mt-4 mx-4 sm:mx-6 lg:mx-8 flex items-start justify-between gap-3 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
        >
          <span>{notice}</span>
          <button className="font-semibold underline" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 px-4 sm:px-6 lg:px-8">
        {/* One line: search, a Filters button that says how many are on, and the
            clients toggle. The seven dropdowns that used to live here moved
            into the panel below — they were readable individually and
            overwhelming together. Anything switched on still shows as a
            removable chip underneath, so no filter is ever silently applied
            from inside a closed panel. */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-[220px] max-w-sm flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <Search className="size-3.5 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ID, name, phone, enquiry, or who added it"
              aria-label="Search leads by ID, name, phone, enquiry, or who added it"
              className="w-full border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
            />
          </div>

          <button
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            aria-controls="lead-filter-panel"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              panelFilterCount > 0
                ? "border-primary-200 bg-primary-50 text-primary-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            <SlidersHorizontal className="size-3.5" />
            Filters
            {panelFilterCount > 0 && (
              <span className="rounded-full bg-primary-600 px-1.5 font-mono text-[10px] font-bold text-white">
                {panelFilterCount}
              </span>
            )}
            <ChevronDown className={cn("size-3.5 transition-transform", filtersOpen && "rotate-180")} />
          </button>

          {/* Converted leads live on the Clients page; this brings them back
              into view without sending the founder to another screen. */}
          <label
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
              showClients ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white text-slate-600"
            )}
            title="Clients are hidden by default so this list shows what's still to win"
          >
            <input
              type="checkbox"
              checked={showClients}
              onChange={(e) => setShowClients(e.target.checked)}
              className="size-3.5 rounded border-slate-300"
            />
            Show clients
            {clientCount > 0 && (
              <span className="rounded-full bg-white/70 px-1.5 font-mono text-[10px] font-bold">{clientCount}</span>
            )}
          </label>
        </div>

        {filtersOpen && (
          <Card id="lead-filter-panel" className="p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FilterField label="Owner">
                <select
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  aria-label="Filter by owner"
                  className="input"
                >
                  <option value={ALL_OWNERS}>{ALL_OWNERS}</option>
                  {hasUnassigned && <option value={UNASSIGNED}>Unassigned</option>}
                  {owners.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Source">
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  aria-label="Filter by source"
                  className="input"
                >
                  <option value={ALL_SOURCES}>{ALL_SOURCES}</option>
                  {hasSourceless && <option value={NO_SOURCE}>No source</option>}
                  {sources.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField
                label="Score"
                help="The latest AI score (0-100) from that lead's most recent analysed call. A lead nobody has called yet has no score at all — that's the 'Not scored yet' option, not a zero."
              >
                <select
                  value={scoreBand}
                  onChange={(e) => setScoreBand(e.target.value)}
                  aria-label="Filter by score"
                  className="input"
                >
                  {SCORE_BANDS.map((b) => (
                    <option key={b.key} value={b.key}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField
                label="Deal value"
                help="What the deal is worth. Only set when a lead reaches Closed Won, so most open leads have no value yet."
              >
                <select
                  value={valueBand}
                  onChange={(e) => setValueBand(e.target.value)}
                  aria-label="Filter by deal value"
                  className="input"
                >
                  {VALUE_BANDS.map((b) => (
                    <option key={b.key} value={b.key}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField
                label="Last update"
                help="How long since anything changed on the lead — a call, a stage move, an edit. 'Stale' is where leads quietly go to die."
              >
                <select
                  value={updatedBand}
                  onChange={(e) => setUpdatedBand(e.target.value)}
                  aria-label="Filter by last update"
                  className="input"
                >
                  {UPDATED_BANDS.map((b) => (
                    <option key={b.key} value={b.key}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField
                label="Enquiry"
                help="What the lead actually asked about. Leads with no enquiry recorded are usually imported or auto-captured ones worth qualifying."
              >
                <select
                  value={enquiryBand}
                  onChange={(e) => setEnquiryBand(e.target.value)}
                  aria-label="Filter by enquiry"
                  className="input"
                >
                  {ENQUIRY_BANDS.map((b) => (
                    <option key={b.key} value={b.key}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </FilterField>
            </div>

            {panelFilterCount > 0 && (
              <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
                <button className="text-xs font-semibold text-slate-600 underline hover:text-slate-900" onClick={clearFilters}>
                  Reset all filters
                </button>
              </div>
            )}
          </Card>
        )}

        <div className="flex flex-wrap gap-1.5">
          {[ALL, ...STAGE_ORDER].map((s) => {
            const count = s === ALL ? inScope.length : stageCounts[s] ?? 0;
            const active = stage === s;
            return (
              <button
                key={s}
                onClick={() => setStage(s)}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  active ? "bg-primary-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                )}
              >
                {s}
                <span
                  className={cn(
                    "rounded-full px-1.5 font-mono text-[10px] font-bold",
                    active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {filtering && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Filters</span>
            {activeFilters.map((f) => (
              <button
                key={f.label}
                onClick={f.clear}
                className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100"
                aria-label={`Remove filter ${f.label}`}
              >
                {f.label}
                <X className="size-3" />
              </button>
            ))}
            <button className="ml-1 text-xs font-semibold text-slate-600 underline hover:text-slate-900" onClick={clearFilters}>
              Clear all
            </button>
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 mx-4 sm:mx-6 lg:mx-8 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error} —{" "}
          <button className="font-semibold underline" onClick={load}>
            Retry
          </button>
        </div>
      )}

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <SortableTh label="Lead" sortKey="name" active={sortKey} dir={sortDir} onSort={toggleSort} className="px-5 py-2.5" />
                  <th className="px-3 py-2.5">Enquiry</th>
                  <th className="px-3 py-2.5">Source</th>
                  <th className="px-3 py-2.5">Stage</th>
                  <SortableTh label="Score" sortKey="score" active={sortKey} dir={sortDir} onSort={toggleSort} className="px-3 py-2.5" />
                  <SortableTh label="Value" sortKey="value" active={sortKey} dir={sortDir} onSort={toggleSort} className="px-3 py-2.5" />
                  <th className="px-3 py-2.5">Owner</th>
                  <SortableTh
                    label="Last Update"
                    sortKey="updated"
                    active={sortKey}
                    dir={sortDir}
                    onSort={toggleSort}
                    className="px-5 py-2.5"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <>
                    <SkeletonTableRow columns={8} />
                    <SkeletonTableRow columns={8} />
                    <SkeletonTableRow columns={8} />
                    <SkeletonTableRow columns={8} />
                    <SkeletonTableRow columns={8} />
                  </>
                ) : error ? (
                  // The red strip above already explains what happened. Without
                  // this branch the table also printed "No leads yet." directly
                  // under it — the app asserting the org has no leads at the one
                  // moment it demonstrably cannot know. (Kanban already guards
                  // its empty state the same way.)
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-600">
                      Leads couldn&apos;t be loaded.
                    </td>
                  </tr>
                ) : visible.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-600">
                      {/* "No data" and "your filters matched nothing" are
                          different problems with different fixes, so only the
                          second one gets a Clear filters escape hatch. */}
                      {filtering ? (
                        <>
                          No leads match these filters.{" "}
                          <button className="font-semibold text-primary-600 underline" onClick={clearFilters}>
                            Clear filters
                          </button>
                        </>
                      ) : (
                        "No leads yet."
                      )}
                    </td>
                  </tr>
                ) : (
                  visible.map((l) => (
                    <tr
                      key={l.id}
                      onClick={() => router.push(`/dashboard/leads/detail?id=${l.id}`)}
                      className="cursor-pointer hover:bg-slate-50"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <Link href={`/dashboard/leads/detail?id=${l.id}`} className="font-medium text-slate-900 hover:text-primary-600">
                            {l.name}
                          </Link>
                          {l.is_client && <ClientBadge />}
                        </div>
                        {l.phone && <span className="block text-xs text-slate-600">{l.phone}</span>}
                        <CopyableId id={l.id} displayId={l.display_id} className="mt-0.5" />
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-3 text-slate-500">{l.reason || "—"}</td>
                      <td className="px-3 py-3 text-slate-500">{l.source || "—"}</td>
                      <td className="px-3 py-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", stagePill[l.pipeline_stage])}>
                          {l.pipeline_stage}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-mono text-slate-700">{l.score ?? "—"}</td>
                      <td className="px-3 py-3 font-mono text-slate-700">{l.deal_value != null ? formatINR(l.deal_value) : "—"}</td>
                      <td className="px-3 py-3 text-slate-500">{l.telecaller_name || "—"}</td>
                      <td className="px-5 py-3 font-mono text-xs text-slate-600">{freshLabel(l.days_stuck)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* "Showing 0 of 0 leads" is a claim about the org's data, so it's
              suppressed on a failed fetch alongside the empty state. */}
          {!loading && !error && (
            <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-600">
              Showing {visible.length} of {inScope.length} leads
              {!showClients && clientCount > 0 && (
                <>
                  {" "}
                  · {clientCount} {clientCount === 1 ? "client" : "clients"} hidden
                </>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function FilterField({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
        {help && <InfoTip label={`What ${label} means`} text={help} />}
      </label>
      {children}
    </div>
  );
}

/** Shown wherever a lead appears, at any stage — being a customer is not a
 *  pipeline position. */
export function ClientBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700",
        className
      )}
    >
      <BadgeCheck className="size-3" /> Client
    </span>
  );
}

function SortableTh({
  label,
  sortKey,
  active,
  dir,
  onSort,
  className,
}: {
  label: string;
  sortKey: Exclude<SortKey, null>;
  active: SortKey;
  dir: SortDir;
  onSort: (key: Exclude<SortKey, null>) => void;
  className?: string;
}) {
  const isActive = active === sortKey;
  const Icon = !isActive ? ChevronsUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={className} aria-sort={isActive ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide hover:text-slate-900",
          isActive ? "text-slate-900" : "text-slate-600"
        )}
      >
        {label}
        <Icon className={cn("size-3", isActive ? "text-primary-600" : "text-slate-400")} />
      </button>
    </th>
  );
}

export default function AllLeadsPage() {
  // useSearchParams needs a Suspense boundary under `output: "export"`.
  return (
    <Suspense fallback={<div className="px-4 pt-6 sm:px-6 lg:px-8 text-sm text-slate-600">Loading leads…</div>}>
      <AllLeadsContent />
    </Suspense>
  );
}
