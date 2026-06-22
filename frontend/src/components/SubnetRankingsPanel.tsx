import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { DATA_REFRESH_INTERVAL_MS } from "../config";
import type { SubnetRankingEntry, SubnetRankingsResponse } from "../types";
import { formatPercent, formatRelativeTime, formatTao, formatTime } from "../utils/format";

interface SubnetRankingsPanelProps {
  onSelectSubnet?: (netuid: number) => void;
}

export function SubnetRankingsPanel({ onSelectSubnet }: SubnetRankingsPanelProps) {
  const [data, setData] = useState<SubnetRankingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasDataRef = useRef(false);

  const load = useCallback(async (refresh: boolean) => {
    if (refresh) {
      setRefreshing(true);
    } else if (!hasDataRef.current) {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await api.getSubnetRankings({ refresh });
      setData(result);
      hasDataRef.current = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load rankings";
      if (message.includes("404") || message.toLowerCase().includes("not found")) {
        setError(
          "Rankings endpoint not found — restart the backend so it picks up the latest code.",
        );
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
    const interval = setInterval(() => load(true), DATA_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Subnet rankings</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            All subnets sorted by{" "}
            <span className="text-slate-300">miner/day</span> (highest first).
            Miner/Day is total projected daily income across all miners.
          </p>
          {data ? (
            <p className="mt-2 text-xs text-slate-500" title={formatTime(data.updated_at)}>
              Updated {formatRelativeTime(data.updated_at)}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading || refreshing}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-sky-400/40 hover:text-white disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-slate-400">
          Loading subnet rankings…
          <p className="mt-2 text-xs text-slate-500">
            First load may take several minutes while miner daily totals are fetched.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Subnet</th>
                  <th className="px-4 py-3">Incentive burn</th>
                  <th className="px-4 py-3">Miner/Day</th>
                  <th className="px-4 py-3">Register fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(data?.rankings ?? []).map((row) => (
                  <RankingRow key={row.netuid} row={row} onSelectSubnet={onSelectSubnet} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function RankingRow({
  row,
  onSelectSubnet,
}: {
  row: SubnetRankingEntry;
  onSelectSubnet?: (netuid: number) => void;
}) {
  const clickable = row.tracked && onSelectSubnet;
  return (
    <tr
      className={`text-slate-200 ${clickable ? "cursor-pointer hover:bg-white/[0.03]" : ""}`}
      onClick={clickable ? () => onSelectSubnet(row.netuid) : undefined}
    >
      <td className="px-4 py-3 font-mono text-slate-400">{row.rank}</td>
      <td className="px-4 py-3">
        <span className="font-medium text-white">SN{row.netuid}</span>
        {row.name ? (
          <span className="text-slate-400">
            {" · "}
            {row.name}
          </span>
        ) : null}
        {row.tracked ? (
          <span className="ml-2 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-sky-300">
            tracked
          </span>
        ) : null}
      </td>
      <td className="px-4 py-3">{formatPercent(row.incentive_burn)}</td>
      <td className="px-4 py-3 text-emerald-300">{formatTao(row.miner_daily_total)} τ</td>
      <td className="px-4 py-3 text-slate-300">{formatTao(row.registration_fee)} τ</td>
    </tr>
  );
}
