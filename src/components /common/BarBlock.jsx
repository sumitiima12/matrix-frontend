import React from "react";
import { compact } from "../../lib/format";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

/** Simple bar series (real quarterly revenue / earnings). */
export default function BarBlock({ data, color }) {
  return <ResponsiveContainer width="100%" height="100%">
    <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
      <CartesianGrid vertical={false} stroke="var(--grid)" />
      <XAxis dataKey="q" tick={{ fontSize: 10, fill: "#8A8A99" }} axisLine={false} tickLine={false} />
      <YAxis hide />
      <Tooltip formatter={(v) => compact(v)} contentStyle={{ borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", fontSize: 12, boxShadow: "var(--shadow)" }} itemStyle={{ color: "var(--ink)" }} />
      <Bar dataKey="v" fill={color} radius={[6, 6, 0, 0]} />
    </BarChart>
  </ResponsiveContainer>;
}
