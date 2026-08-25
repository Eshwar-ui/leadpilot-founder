"use client";

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";

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
      <ul className="mt-1 grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs text-slate-600 sm:grid-cols-2">
        {data.map((d) => (
          <li key={d.skill} className="flex items-baseline justify-between gap-2">
            <span>{d.skill}</span>
            <span className="font-mono font-semibold text-slate-800">
              {d.value}/{AXIS_MAX}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
