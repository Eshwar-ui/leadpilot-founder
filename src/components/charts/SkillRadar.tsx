"use client";

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";

export function SkillRadar({
  skills,
}: {
  skills: { opening: number; product: number; objection: number; closing: number; ei: number; followUp: number };
}) {
  const data = [
    { skill: "Opening", value: skills.opening },
    { skill: "Product", value: skills.product },
    { skill: "Objection", value: skills.objection },
    { skill: "Closing", value: skills.closing },
    { skill: "EI", value: skills.ei },
    { skill: "Follow-up", value: skills.followUp },
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
