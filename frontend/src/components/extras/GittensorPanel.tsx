import { useState } from "react";
import { api } from "../../api/client";
import type { GittensorScore } from "../../types/extras";
import { formatPercent, truncateKey } from "../../utils/format";
import { ErrorText, MiniStat, PanelShell } from "./OroPanel";

export function GittensorPanel() {
  const [pat, setPat] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<GittensorScore | null>(null);

  async function runScore(useEnvPat = false) {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getGittensorScore(useEnvPat ? undefined : pat.trim() || undefined);
      setScore(result);
    } catch (err) {
      setScore(null);
      setError(err instanceof Error ? err.message : "Scoring failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PanelShell title="Gittensor miner score" hint="Runs gitt miner score locally via backend">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="text-xs uppercase tracking-wide text-slate-400">
            GitHub PAT (optional if set in backend .env)
          </label>
          <input
            type="password"
            value={pat}
            onChange={(e) => setPat(e.target.value)}
            placeholder="ghp_…"
            className="mono mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring focus:ring-emerald-400/40"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => runScore(false)}
            disabled={loading}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50"
          >
            {loading ? "Scoring…" : "Score miner"}
          </button>
          <button
            type="button"
            onClick={() => runScore(true)}
            disabled={loading}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200 disabled:opacity-50"
          >
            Use .env PAT
          </button>
        </div>
      </div>

      {error ? <div className="mt-3"><ErrorText message={error} /></div> : null}

      {score ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <MiniStat label="Total score" value={score.total_score.toFixed(2)} />
            <MiniStat label="Blended reward" value={formatPercent(score.blended_reward)} />
            <MiniStat label="Merged PRs" value={String(score.merged_prs)} />
            <MiniStat
              label="Eligible"
              value={score.is_eligible ? "Yes" : "No"}
              sub={score.hotkey ? truncateKey(score.hotkey, 8, 6) : undefined}
            />
          </div>

          {score.allocation.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-white/10">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Repository</th>
                    <th className="px-3 py-2">PR score</th>
                    <th className="px-3 py-2">Emission share</th>
                    <th className="px-3 py-2">Reward</th>
                  </tr>
                </thead>
                <tbody>
                  {score.allocation.map((row) => (
                    <tr key={row.repository_full_name} className="border-b border-white/5">
                      <td className="px-3 py-2 text-white">{row.repository_full_name}</td>
                      <td className="px-3 py-2">{row.pr_score.toFixed(2)}</td>
                      <td className="px-3 py-2">{formatPercent(row.emission_share)}</td>
                      <td className="px-3 py-2">{row.total_reward.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </PanelShell>
  );
}
