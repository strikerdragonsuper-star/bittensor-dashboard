import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { CliqueRuns } from "../../types/extras";
import { formatPercent, truncateKey } from "../../utils/format";
import { ErrorText, PanelShell } from "./OroPanel";

export function CliquePanel() {
  const [data, setData] = useState<CliqueRuns | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getCliqueRuns()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load W&B runs"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <PanelShell title="CliqueAI validator runs">Loading W&B runs…</PanelShell>;
  }

  if (error) {
    return (
      <PanelShell title="CliqueAI validator runs" hint="Requires WANDB_API_KEY in backend/.env">
        <ErrorText message={error} />
        <a
          href="https://wandb.ai/toptensor-ai/CliqueAI/table"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex text-sm text-sky-200 underline"
        >
          Open W&B table ↗
        </a>
      </PanelShell>
    );
  }

  if (!data) return null;

  const latest = data.runs[0];

  return (
    <PanelShell title="CliqueAI validator runs" hint="Latest rounds from W&B">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-slate-400">
          {data.runs.length} recent runs
          {latest?.problem_type ? ` · latest: ${latest.problem_type}` : ""}
        </p>
        <a
          href={data.dashboard_url}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-sky-300 hover:underline"
        >
          W&B table ↗
        </a>
      </div>

      {latest && latest.top_miners.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-white/10">
          <p className="border-b border-white/10 bg-white/[0.03] px-3 py-2 text-xs uppercase text-slate-400">
            Top miners — latest run
          </p>
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2">UID</th>
                <th className="px-3 py-2">Hotkey</th>
                <th className="px-3 py-2">Reward</th>
                <th className="px-3 py-2">Optimality</th>
                <th className="px-3 py-2">Diversity</th>
              </tr>
            </thead>
            <tbody>
              {latest.top_miners.map((m) => (
                <tr key={`${m.uid}-${m.hotkey}`} className="border-b border-white/5">
                  <td className="px-3 py-2">{m.uid}</td>
                  <td className="mono px-3 py-2 text-sky-300">{truncateKey(m.hotkey, 8, 6)}</td>
                  <td className="px-3 py-2">{m.reward.toFixed(4)}</td>
                  <td className="px-3 py-2">{formatPercent(m.optimality)}</td>
                  <td className="px-3 py-2">{formatPercent(m.diversity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-slate-400">No miner scores in the latest run.</p>
      )}
    </PanelShell>
  );
}
