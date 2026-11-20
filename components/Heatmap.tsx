import {
  ConceptStat,
  share,
  total,
  strugglingRatio,
  isBottleneck,
} from "@/lib/heatmap";

const COLS = [
  { k: "knows", label: "Knows", rgb: "34,197,94" },
  { k: "developing", label: "Developing", rgb: "245,158,11" },
  { k: "struggles", label: "Struggles", rgb: "239,68,68" },
] as const;

export default function Heatmap({ stats }: { stats: ConceptStat[] }) {
  const nameById = new Map(stats.map((s) => [s.conceptId, s.name]));

  return (
    <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="p-3">Sub-Concept &amp; Prerequisite Map</th>
            {COLS.map((c) => (
              <th key={c.k} className="p-3 text-center">
                {c.label}
              </th>
            ))}
            <th className="p-3 text-center">Assessed</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s, idx) => {
            const count = total(s);
            const bottleneck = isBottleneck(s);
            return (
              <tr key={s.conceptId} className="border-t align-top">
                <td className="p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-brand">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-gray-900">{s.name}</span>
                    {bottleneck && (
                      <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                        {Math.round(strugglingRatio(s) * 100)}% struggling · Bottleneck
                      </span>
                    )}
                  </div>
                  {s.summary && (
                    <p className="mt-1 text-xs text-gray-600">{s.summary}</p>
                  )}
                  {s.prereqIds && s.prereqIds.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {s.prereqIds.map((pid) => (
                        <span
                          key={pid}
                          className="rounded border bg-gray-50 px-1.5 py-0.5 text-[11px] text-gray-600"
                        >
                          Needs: {nameById.get(pid) ?? pid}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                {COLS.map((c) => {
                  const ratio = share(s, c.k);
                  const pct = Math.round(ratio * 100);
                  return (
                    <td
                      key={c.k}
                      className="p-3 text-center align-middle"
                      style={{
                        backgroundColor: `rgba(${c.rgb},${0.08 + ratio * 0.65})`,
                      }}
                    >
                      <div className="font-bold text-gray-900">{s[c.k]}</div>
                      <div className="text-[11px] text-gray-700">
                        {count > 0 ? `${pct}%` : "—"}
                      </div>
                    </td>
                  );
                })}
                <td className="p-3 text-center align-middle font-medium text-gray-700">
                  {count}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
