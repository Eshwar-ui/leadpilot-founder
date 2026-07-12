"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function AlertBanner({
  label,
  message,
  cta,
  href,
}: {
  label: string;
  message: string;
  cta: string;
  href?: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  const router = useRouter();
  if (dismissed) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
      <div className="flex items-center gap-3">
        <AlertTriangle className="size-5 shrink-0 text-red-500" />
        <p className="text-sm text-red-700">
          <span className="font-semibold uppercase">{label}</span> · {message}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="danger" size="sm" onClick={() => href && router.push(href)}>
          {cta}
        </Button>
        <button onClick={() => setDismissed(true)} className="text-red-400 hover:text-red-600">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
