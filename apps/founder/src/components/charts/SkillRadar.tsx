"use client";

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";
import { InfoTip } from "@/components/ui/InfoTip";

// 5 dimensions, matching the rubric actually implemented in the backend
// (config/score_dimensions.json: opening/discovery/pitch/objection_handling/
// closing, 20pts each) — not the 6 fictional ones (product/ei/followUp) the
// original mock invented.
//
// Every axis is out of 20, so the radius domain is PINNED to [0, 20]. Recharts
// otherwise defaults it to [0, dataMax], which drew an identical full pentagon
// for a telecaller scoring 4/20 on every axis and one scoring 20/20 — and made
// this chart incomparable between the Detail page and the Comparison page's
// side-by-side overlay, which is the whole point of the overlay.
const AXIS_MAX = 20;

// What each axis actually rates. Without these the chart is five words a
// founder has to guess at — and "Discovery" and "Objection" in particular get
// read as things about the LEAD rather than about how the telecaller handled
// the call. Wording mirrors the rubric in config/score_dimensions.json.
const SKILL_HELP: Record<string, string> = {
  Opening:
    "How the call started — did they introduce themselves and the company clearly, and give the customer a reason to keep listening in the first few seconds?",
  Discovery:
    "How well they asked questions and listened. Did they find out the customer's budget, timeline and real need, instead of pitching straight away?",
  Pitch:
    "How clearly they explained what's on offer and tied it to what the customer actually said they wanted — rather than reciting a generic script.",
  Objection:
    "How they handled pushback on price, timing or competitors. Did they answer the concern with something concrete, or dodge and repeat the pitch?",
  Closing:
    "How the call ended. Did they ask for a clear next step — a visit, a callback, a decision date — or let it finish with a vague 'think about it'?",
};

export function SkillRadar({
  skills,
}: {
  skills: { opening: number; discovery: number; pitch: number; objectionHandling: number; closing: number };
}) {
  const data = [
    { skill: "Opening", value: skills.opening },
    { skill: "Discovery", value: skills.discovery },
    { skill: "Pitch", value: skills.pitch },
    { skill: "Objection", value: skills.objectionHandling },
    { skill: "Closing", value: skills.closing },
  ];

  // The SVG carries no accessible text of its own, and the shape alone doesn't
  // tell a founder what the numbers are — the value list below is the readable
  // (and screen-reader) version of the same data, not decoration.
  const summary = data.map((d) => `${d.skill} ${d.value} out of ${AXIS_MAX}`).join(", ");

  return (
    <div>
      <div role="img" aria-label={`Skill breakdown: ${summary}`}>
        <ResponsiveContainer width="100%" height={240}>
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: "#475569" }} />
            <PolarRadiusAxis
              angle={90}
              domain={[0, AXIS_MAX]}
              tickCount={5}
              tick={{ fontSize: 9, fill: "#64748b" }}
              axisLine={false}
            />
            <Radar dataKey="value" stroke="#4f6ef2" fill="#4f6ef2" fillOpacity={0.25} strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-500">
        How this telecaller handled their calls, averaged across every analysed call. Each skill is scored out of{" "}
        {AXIS_MAX} by the AI — it rates their <span className="font-semibold">handling</span>, not the quality of the
        leads they were given.
      </p>
      <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-2">
        {data.map((d) => (
          <li key={d.skill} className="flex items-baseline justify-between gap-2">
            <span className="flex items-center gap-1">
              {d.skill}
              {SKILL_HELP[d.skill] && <InfoTip label={`What ${d.skill} measures`} text={SKILL_HELP[d.skill]} />}
            </span>
            <span className="font-mono font-semibold text-slate-800">
              {d.value}/{AXIS_MAX}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
