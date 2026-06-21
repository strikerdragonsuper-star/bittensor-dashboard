import { type ReactNode, useEffect, useState } from "react";
import { api } from "../../api/client";
import type { OroLeaderboard } from "../../types/extras";
import { formatPercent, truncateKey } from "../../utils/format";

export function OroPanel() {
  const [data, setData] = useState<OroLeaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getOroLeaderboard()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load ORO data"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <PanelShell title="ORO race leaderboard">Loading race data…</PanelShell>;
  }

  if (error) {
    return <PanelShell title="ORO race leaderboard"><ErrorText message={error} /></PanelShell>;
  }

  if (!data) return null;

  return (
    <PanelShell title="ORO race leaderboard" hint="Public data from api.oroagents.com">
      <div className="grid gap-4 md:grid-cols-3">
        <MiniStat
          label="Top agent score"
          value={formatPercent(data.top_agent.top_score)}
          sub={
            data.top_agent.top_miner_hotkey
              ? truncateKey(data.top_agent.top_miner_hotkey, 10, 6)
              : "No leader yet"
          }
        />
        <MiniStat
          label="Recent races"
          value={String(data.recent_races.length)}
          sub={data.latest_race_id ? `Latest: ${data.latest_race_id.slice(0, 8)}…` : undefined}
        />
        <MiniStat
          label="Latest race finishers"
          value={String(data.latest_race_qualifiers.length)}
          sub="Ranked by race score"
        />
      </div>

      {data.latest_race_qualifiers.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-lg border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2">Rank</th>
                <th className="px-3 py-2">Agent</th>
                <th className="px-3 py-2">Hotkey</th>
                <th className="px-3 py-2">Race score</th>
              </tr>
            </thead>
            <tbody>
              {data.latest_race_qualifiers.map((q) => (
                <tr key={`${q.rank}-${q.miner_hotkey}`} className="border-b border-white/5">
                  <td className="px-3 py-2">{q.rank}</td>
                  <td className="px-3 py-2 text-white">{q.agent_name ?? "—"}</td>
                  <td className="mono px-3 py-2 text-sky-300">
                    {q.miner_hotkey ? truncateKey(q.miner_hotkey, 8, 6) : "—"}
                  </td>
                  <td className="px-3 py-2">{q.race_score != null ? formatPercent(q.race_score) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </PanelShell>
  );
}

function PanelShell({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.04] p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-violet-200">{title}</h3>
        {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
      {sub ? <p className="mono mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

function ErrorText({ message }: { message: string }) {
  return <p className="text-sm text-rose-300">{message}</p>;
}

export { PanelShell, MiniStat, ErrorText };
