"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check, Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  ApiError,
  leadImportApi,
  type ImportField,
  type ImportParseResult,
  type ImportValidatedRow,
} from "@/lib/api";
import { cn } from "@/lib/utils";

/** Bulk import: upload a sheet, say which column is what, fix the rows that
 *  need it, then create only the good ones.
 *
 *  The review step is the point of the feature — a row missing a phone number
 *  is fixed in the grid and re-checked in place, rather than sending the
 *  founder back to Excel to re-export. */

const STEPS = ["Upload", "Map columns", "Review & fix"] as const;

const FIELD_LABEL: Record<ImportField, string> = {
  name: "Name",
  phone: "Phone",
  source: "Source",
  reason: "Enquiry",
};

const REQUIRED_FIELDS: ImportField[] = ["name", "phone"];

const AUTO = "__auto__";

type EditableRow = {
  index: number;
  name: string;
  phone: string;
  source: string;
  reason: string;
  assignedTo: string; // AUTO, or a telecaller id
};

const statusStyles: Record<ImportValidatedRow["status"], string> = {
  ok: "bg-emerald-50 text-emerald-700",
  duplicate: "bg-amber-50 text-amber-800",
  invalid: "bg-red-50 text-red-700",
};

export default function ImportLeadsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [parsed, setParsed] = useState<ImportParseResult | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [mapping, setMapping] = useState<Record<ImportField, string | null>>({
    name: null,
    phone: null,
    source: null,
    reason: null,
  });

  const [rows, setRows] = useState<EditableRow[]>([]);
  const [validation, setValidation] = useState<Map<number, ImportValidatedRow>>(new Map());
  const [validating, setValidating] = useState(false);

  const [telecallers, setTelecallers] = useState<{ id: string; name: string }[]>([]);
  const [batchOwner, setBatchOwner] = useState<string>(AUTO);

  const [result, setResult] = useState<Awaited<ReturnType<typeof leadImportApi.commit>> | null>(null);

  useEffect(() => {
    leadImportApi
      .telecallers()
      .then((r) => setTelecallers(r.telecallers))
      // Non-fatal: without the list, every row just stays on Auto (round-robin),
      // which is the default anyway.
      .catch(() => setTelecallers([]));
  }, []);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const res = await leadImportApi.parse(file);
      setParsed(res);
      setFileName(file.name);
      setMapping(res.suggested_mapping);
      setStep(1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't read that file.");
    } finally {
      setBusy(false);
    }
  }

  const mappingComplete = REQUIRED_FIELDS.every((f) => !!mapping[f]);

  const runValidation = useCallback(
    async (candidate: EditableRow[]) => {
      setValidating(true);
      try {
        // Validation always runs against the CURRENT grid values (which may
        // have been hand-edited), not the original file — so a fixed row is
        // re-checked as edited rather than as uploaded.
        const payload = candidate.map((r) => ({
          Name: r.name,
          Phone: r.phone,
          Source: r.source,
          Enquiry: r.reason,
        }));
        const res = await leadImportApi.validate(payload, {
          name: "Name",
          phone: "Phone",
          source: "Source",
          reason: "Enquiry",
        });
        setValidation(new Map(res.rows.map((r) => [r.index, r])));
        setError(null);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Couldn't check these rows.");
      } finally {
        setValidating(false);
      }
    },
    []
  );

  async function goToReview() {
    if (!parsed || !mappingComplete) return;
    const next: EditableRow[] = parsed.rows.map((raw, i) => ({
      index: i,
      name: (mapping.name && raw[mapping.name]) || "",
      phone: (mapping.phone && raw[mapping.phone]) || "",
      source: (mapping.source && raw[mapping.source]) || "",
      reason: (mapping.reason && raw[mapping.reason]) || "",
      assignedTo: AUTO,
    }));
    setRows(next);
    setStep(2);
    await runValidation(next);
  }

  // Re-check after an edit, debounced so typing a phone number doesn't fire a
  // request per keystroke.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function editRow(index: number, patch: Partial<EditableRow>) {
    setRows((prev) => {
      const next = prev.map((r) => (r.index === index ? { ...r, ...patch } : r));
      if (patch.name !== undefined || patch.phone !== undefined) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => runValidation(next), 500);
      }
      return next;
    });
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const summary = useMemo(() => {
    let ok = 0,
      duplicate = 0,
      invalid = 0;
    for (const r of rows) {
      const v = validation.get(r.index);
      if (!v) continue;
      if (v.status === "ok") ok++;
      else if (v.status === "duplicate") duplicate++;
      else invalid++;
    }
    return { ok, duplicate, invalid };
  }, [rows, validation]);

  async function commit() {
    const importable = rows.filter((r) => validation.get(r.index)?.status === "ok");
    if (!importable.length) return;
    setBusy(true);
    setError(null);
    try {
      const res = await leadImportApi.commit(
        importable.map((r) => ({
          name: r.name,
          phone: r.phone,
          source: r.source || undefined,
          reason: r.reason || undefined,
          ...(r.assignedTo !== AUTO ? { assigned_to: r.assignedTo } : {}),
        })),
        batchOwner !== AUTO ? batchOwner : undefined
      );
      setResult(res);
      setStep(3);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The import couldn't be completed.");
    } finally {
      setBusy(false);
    }
  }

  function downloadUnimported() {
    const rejected = rows
      .map((r) => ({ row: r, v: validation.get(r.index) }))
      .filter(({ v }) => v && v.status !== "ok");
    const header = ["Name", "Phone", "Source", "Enquiry", "Why it wasn't imported"];
    const escape = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const lines = rejected.map(({ row, v }) =>
      [
        row.name,
        row.phone,
        row.source,
        row.reason,
        v!.status === "duplicate" ? `Already a lead (${v!.duplicate_of ?? "existing"})` : v!.errors.join("; "),
      ]
        .map((c) => escape(String(c)))
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads-not-imported.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="pb-10">
      <div className="px-4 pt-6 sm:px-6 lg:px-8">
        <Link
          href="/dashboard/leads"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-primary-600"
        >
          <ArrowLeft className="size-3.5" /> All Leads
        </Link>
      </div>

      <PageHeader
        title="Import Leads"
        description="Upload a CSV or Excel sheet. You can fix anything that's missing before it's saved."
      />

      <div className="mt-4 px-4 sm:px-6 lg:px-8">
        <ol className="flex flex-wrap items-center gap-2 text-xs font-medium">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                  step > i ? "bg-emerald-500 text-white" : step === i ? "bg-primary-600 text-white" : "bg-slate-200 text-slate-600"
                )}
              >
                {step > i ? <Check className="size-3" /> : i + 1}
              </span>
              <span className={cn(step === i ? "text-slate-900" : "text-slate-500")}>{label}</span>
              {i < STEPS.length - 1 && <span className="mx-1 text-slate-300">→</span>}
            </li>
          ))}
        </ol>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 mx-4 sm:mx-6 lg:mx-8 flex items-start justify-between gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          <span>{error}</span>
          <button className="font-semibold underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* ── Step 1: upload ── */}
      {step === 0 && (
        <div className="mt-4 px-4 sm:px-6 lg:px-8">
          <Card className="p-8">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 px-6 py-12 text-center"
            >
              <FileSpreadsheet className="size-8 text-slate-400" />
              <p className="mt-3 text-sm font-medium text-slate-900">Drop your sheet here</p>
              <p className="mt-1 text-xs text-slate-500">.csv or .xlsx, up to 5MB and 2,000 rows</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.xlsx,.xlsm"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
              <Button className="mt-4" size="sm" disabled={busy} onClick={() => fileInputRef.current?.click()}>
                <Upload className="size-3.5" /> {busy ? "Reading…" : "Choose a file"}
              </Button>
              <p className="mt-4 max-w-md text-xs text-slate-500">
                Your sheet needs at least a name and a phone number per lead. Anything else — source, enquiry — is
                optional, and you can map it on the next step.
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* ── Step 2: map columns ── */}
      {step === 1 && parsed && (
        <div className="mt-4 px-4 sm:px-6 lg:px-8">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Which column is which?</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {fileName} · {parsed.row_count} {parsed.row_count === 1 ? "row" : "rows"}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setStep(0)}>
                Choose a different file
              </Button>
            </div>

            {parsed.truncated && (
              <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                This file has more than {parsed.max_rows.toLocaleString()} rows. Only the first{" "}
                {parsed.max_rows.toLocaleString()} were read — import these, then upload the rest.
              </p>
            )}

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(Object.keys(FIELD_LABEL) as ImportField[]).map((field) => (
                <div key={field}>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {FIELD_LABEL[field]}
                    {REQUIRED_FIELDS.includes(field) && <span className="ml-1 text-red-600">*</span>}
                  </label>
                  <select
                    value={mapping[field] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [field]: e.target.value || null }))}
                    className="input"
                  >
                    <option value="">— not in this sheet —</option>
                    {parsed.columns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="mt-5 overflow-x-auto">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                First few rows, as mapped
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {(Object.keys(FIELD_LABEL) as ImportField[]).map((f) => (
                      <th key={f} className="px-3 py-2">
                        {FIELD_LABEL[f]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsed.rows.slice(0, 3).map((raw, i) => (
                    <tr key={i}>
                      {(Object.keys(FIELD_LABEL) as ImportField[]).map((f) => (
                        <td key={f} className="px-3 py-2 text-slate-700">
                          {(mapping[f] && raw[mapping[f]!]) || <span className="text-slate-400">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              {!mappingComplete && (
                <p className="mr-auto text-xs text-slate-500">Pick a Name column and a Phone column to continue.</p>
              )}
              <Button size="sm" disabled={!mappingComplete} onClick={goToReview}>
                Review {parsed.row_count} {parsed.row_count === 1 ? "row" : "rows"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ── Step 3: review & fix ── */}
      {step === 2 && (
        <div className="mt-4 px-4 sm:px-6 lg:px-8">
          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                  {summary.ok} ready
                </span>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">
                  {summary.duplicate} already exist
                </span>
                <span className="rounded-full bg-red-50 px-2.5 py-1 font-semibold text-red-700">
                  {summary.invalid} need fixing
                </span>
                {validating && <span className="text-slate-500">Checking…</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-xs text-slate-600">Assign all to</label>
                <select
                  value={batchOwner}
                  onChange={(e) => setBatchOwner(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600"
                >
                  <option value={AUTO}>Auto (spread evenly)</option>
                  {telecallers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                  Back
                </Button>
                <Button size="sm" disabled={busy || validating || summary.ok === 0} onClick={commit}>
                  {busy ? "Importing…" : `Import ${summary.ok} ${summary.ok === 1 ? "lead" : "leads"}`}
                </Button>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Name</th>
                    <th className="px-3 py-2.5">Phone</th>
                    <th className="px-3 py-2.5">Source</th>
                    <th className="px-3 py-2.5">Enquiry</th>
                    <th className="px-4 py-2.5">Owner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => {
                    const v = validation.get(row.index);
                    const status = v?.status ?? "ok";
                    return (
                      <tr key={row.index} className={cn(status === "invalid" && "bg-red-50/40")}>
                        <td className="px-4 py-2 align-top">
                          <span
                            className={cn(
                              "inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                              statusStyles[status]
                            )}
                          >
                            {status === "ok" ? "Ready" : status === "duplicate" ? "Exists" : "Fix"}
                          </span>
                          {v && status !== "ok" && (
                            <p className="mt-1 max-w-[160px] text-[11px] leading-tight text-slate-600">
                              {status === "duplicate"
                                ? `Already a lead${v.duplicate_of ? ` (${v.duplicate_of})` : ""} — will be skipped`
                                : v.errors.join(" · ")}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <input
                            value={row.name}
                            onChange={(e) => editRow(row.index, { name: e.target.value })}
                            aria-label={`Name for row ${row.index + 1}`}
                            className="w-full min-w-[130px] rounded-md border border-slate-200 px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <input
                            value={row.phone}
                            onChange={(e) => editRow(row.index, { phone: e.target.value })}
                            aria-label={`Phone for row ${row.index + 1}`}
                            className="w-full min-w-[130px] rounded-md border border-slate-200 px-2 py-1 font-mono text-sm"
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <input
                            value={row.source}
                            onChange={(e) => editRow(row.index, { source: e.target.value })}
                            aria-label={`Source for row ${row.index + 1}`}
                            className="w-full min-w-[110px] rounded-md border border-slate-200 px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <input
                            value={row.reason}
                            onChange={(e) => editRow(row.index, { reason: e.target.value })}
                            aria-label={`Enquiry for row ${row.index + 1}`}
                            className="w-full min-w-[150px] rounded-md border border-slate-200 px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2 align-top">
                          <select
                            value={row.assignedTo}
                            onChange={(e) => editRow(row.index, { assignedTo: e.target.value })}
                            aria-label={`Owner for row ${row.index + 1}`}
                            className="w-full min-w-[120px] rounded-md border border-slate-200 px-2 py-1 text-sm"
                          >
                            <option value={AUTO}>Auto</option>
                            {telecallers.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ── Step 4: result ── */}
      {step === 3 && result && (
        <div className="mt-4 px-4 sm:px-6 lg:px-8">
          <Card className="p-6">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Check className="size-4" />
              </span>
              <h3 className="text-base font-semibold text-slate-900">
                {result.created + result.restored} {result.created + result.restored === 1 ? "lead" : "leads"} imported
              </h3>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-slate-600">Created</dt>
                <dd className="mt-0.5 font-mono text-slate-900">{result.created}</dd>
              </div>
              {result.restored > 0 && (
                <div>
                  <dt className="text-xs text-slate-600">Restored from archive</dt>
                  <dd className="mt-0.5 font-mono text-slate-900">{result.restored}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-slate-600">Skipped as duplicates</dt>
                <dd className="mt-0.5 font-mono text-slate-900">{result.skipped}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-600">Telecallers notified</dt>
                <dd className="mt-0.5 font-mono text-slate-900">{result.notified}</dd>
              </div>
            </dl>

            {result.restored > 0 && (
              <p className="mt-3 text-xs text-slate-600">
                Restored leads were previously archived — they came back with their existing call history attached
                rather than as new records.
              </p>
            )}

            {(summary.duplicate > 0 || summary.invalid > 0) && (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                <p className="flex-1 text-xs text-slate-700">
                  {summary.duplicate + summary.invalid === 1
                    ? "1 row wasn't imported. Download it to fix and re-upload."
                    : `${summary.duplicate + summary.invalid} rows weren't imported. Download them to fix and re-upload.`}
                </p>
                <Button variant="outline" size="sm" onClick={downloadUnimported}>
                  <Download className="size-3.5" /> Download
                </Button>
              </div>
            )}

            <div className="mt-5 flex items-center gap-2">
              <Button size="sm" onClick={() => router.push("/dashboard/leads")}>
                Go to All Leads
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStep(0);
                  setParsed(null);
                  setRows([]);
                  setValidation(new Map());
                  setResult(null);
                  setBatchOwner(AUTO);
                }}
              >
                <X className="size-3.5" /> Import another file
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
