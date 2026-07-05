"use client";

import { useState } from "react";
import { X } from "lucide-react";

/** Type-and-press-Enter chip input, used for the free-form list fields in the
 * Organisation Knowledge Base (services, USPs, competitors). */
export function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft("");
  }

  return (
    <div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        placeholder={placeholder}
        className="input"
      />
      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {values.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="group flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              {v}
              <X className="size-3 text-slate-400 group-hover:text-slate-600" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
