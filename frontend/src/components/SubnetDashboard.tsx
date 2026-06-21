import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { NeuronRecord, SubnetOverview, SubnetSummary } from "../types";
import { formatPercent, formatTao, formatTime } from "../utils/format";
import { NeuronTable } from "./NeuronTable";
import { StatCard } from "./StatCard";
import { SubnetExtras } from "./extras/SubnetExtras";

interface SubnetDashboardProps {
  netuid: number;
  summary: SubnetSummary;
}

export function SubnetDashboard({ netuid, summary }: SubnetDashboardProps) {
  const [overview, setOverview] = useState<SubnetOverview | null>(null);
  const [miners, setMiners] = useState<NeuronRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [overviewResult, neuronsResult] = await Promise.all([
          api.getOverview(netuid),
          api.getNeurons(netuid, "miner"),
        ]);
        if (!cancelled) {
          setOverview(overviewResult);
          setMiners(neuronsResult.neurons);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load subnet data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [netuid]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-sky-300/80">Subnet {netuid}</p>
          <h2 className="text-2xl font-semibold text-white">{summary.name}</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">{summary.description}</p>
        </div>
        <a
          href={summary.dashboard_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200 transition hover:border-sky-400/40 hover:text-white"
        >
          Official dashboard ↗
        </a>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Miners"
          value={overview ? String(overview.miner_count) : "—"}
          hint={overview ? `Active on subnet ${netuid}` : undefined}
        />
        <StatCard
          label="Miner stake"
          value={overview ? `${formatTao(overview.total_stake)} τ` : "—"}
        />
        <StatCard
          label="Total daily income"
          value={overview ? `${formatTao(overview.total_daily_income)} τ` : "—"}
          hint="Sum of projected daily τ rewards"
        />
        <StatCard
          label="Avg incentive"
          value={overview ? formatPercent(overview.avg_incentive) : "—"}
          hint={overview ? `Block ${overview.block}` : undefined}
        />
      </div>

      <SubnetExtras netuid={netuid} />

      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium text-slate-300">Miner rankings</h3>
        {overview ? (
          <span className="ml-auto text-xs text-slate-500">
            Updated {formatTime(overview.updated_at)}
          </span>
        ) : null}
      </div>

      <NeuronTable neurons={miners} loading={loading} />
    </div>
  );
}
