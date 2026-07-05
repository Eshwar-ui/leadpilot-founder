"use client";

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";

// 5 dimensions, matching the rubric actually implemented in the backend
// (config/score_dimensions.json: opening/discovery/pitch/objection_handling/
// closing, 20pts each) — not the 6 fictional ones (product/ei/followUp) the
// original mock invented.
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

  return (
    <ResponsiveContainer width="100%" height={240}>
      <RadarChart data={data} outerRadius="75%">
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: "#64748b" }} />
        <Radar dataKey="value" stroke="#4f6ef2" fill="#4f6ef2" fillOpacity={0.25} strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
