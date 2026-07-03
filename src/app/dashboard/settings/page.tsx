import { User, Bell, Megaphone, Link2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";

const CARDS = [
  {
    icon: User,
    title: "Users & Roles",
    description: "Manage founder, manager, and telecaller accounts.",
  },
  {
    icon: Bell,
    title: "Alert Configuration",
    description: "Set thresholds for every alert type.",
  },
  {
    icon: Megaphone,
    title: "Budget Guardrail Rules",
    description: "Configure warn (90%), auto-pause individual (120%), and auto-pause all (115%) rules.",
  },
  {
    icon: Link2,
    title: "Integrations",
    description: "Connect Meta CAPI, Google Offline Conversions, Exotel, WhatsApp Business.",
  },
];

export default function SettingsPage() {
  return (
    <div className="pb-10">
      <PageHeader title="Settings" description="Portal configuration, users, integrations, and notification rules" />

      <div className="mt-4 grid grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 sm:grid-cols-2">
        {CARDS.map((c) => (
          <Card key={c.title} className="flex cursor-pointer items-start gap-4 p-5 hover:shadow-md">
            <span className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              <c.icon className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">{c.title}</p>
              <p className="mt-0.5 text-sm text-slate-500">{c.description}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
