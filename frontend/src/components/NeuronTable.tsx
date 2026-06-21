import type { NeuronRecord } from "../types";
import { formatPercent, formatTao, truncateKey } from "../utils/format";

interface NeuronTableProps {
  neurons: NeuronRecord[];
  loading?: boolean;
}

export function NeuronTable({ neurons, loading }: NeuronTableProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-slate-400">
        Loading miners…
      </div>
    );
  }

  if (neurons.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-slate-400">
        No active miners found on this subnet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">UID</th>
              <th className="px-4 py-3">Hotkey</th>
              <th className="px-4 py-3">Daily income (τ)</th>
              <th className="px-4 py-3">Stake</th>
              <th className="px-4 py-3">Incentive share</th>
              <th className="px-4 py-3">Epoch emission</th>
              <th className="px-4 py-3">Serving</th>
            </tr>
          </thead>
          <tbody>
            {neurons.map((neuron) => (
              <tr
                key={neuron.uid}
                className="border-b border-white/5 transition hover:bg-white/[0.03]"
              >
                <td className="px-4 py-3 text-slate-300">{neuron.rank ?? "—"}</td>
                <td className="px-4 py-3 font-medium text-white">{neuron.uid}</td>
                <td className="mono px-4 py-3 text-sky-300" title={neuron.hotkey}>
                  {truncateKey(neuron.hotkey, 8, 6)}
                </td>
                <td className="px-4 py-3 font-medium text-emerald-300">
                  {formatTao(neuron.daily_income)} τ
                </td>
                <td className="px-4 py-3 text-slate-200">{formatTao(neuron.stake)} τ</td>
                <td className="px-4 py-3 text-slate-200">{formatPercent(neuron.incentive)}</td>
                <td className="px-4 py-3 text-amber-200/80">{formatTao(neuron.emission, 6)}</td>
                <td className="px-4 py-3">
                  <span className={neuron.is_serving ? "text-emerald-400" : "text-slate-500"}>
                    {neuron.is_serving ? "Yes" : "No"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-white/10 px-4 py-2 text-xs text-slate-500">
        Daily income from Taostats <span className="mono">daily_mining_alpha_as_tao</span> (projected τ per day).
      </p>
    </div>
  );
}
