import { useCallback, useEffect, useState } from "react";
import { api } from "./api/client";
import { SubnetDashboard } from "./components/SubnetDashboard";
import { SubnetRankingsPanel } from "./components/SubnetRankingsPanel";
import { WalletPanel } from "./components/WalletPanel";
import { DATA_REFRESH_INTERVAL_MS } from "./config";
import { SUBNETS as STATIC_SUBNETS } from "./subnets";
import type { SubnetOverview, SubnetSummary } from "./types";
import { formatPercent, formatRelativeTime, formatTao, formatTime } from "./utils/format";
import {
  readStoredNetuid,
  readStoredTab,
  storeNetuid,
  storeTab,
  type AppTab,
} from "./utils/preferences";

function mergeSubnetStats(existing: SubnetSummary, incoming: SubnetSummary): SubnetSummary {
  return {
    ...incoming,
    incentive_burn: incoming.incentive_burn ?? existing.incentive_burn,
    registration_fee: incoming.registration_fee ?? existing.registration_fee,
    immune_today_count: incoming.immune_today_count ?? existing.immune_today_count,
    immune_yesterday_count: incoming.immune_yesterday_count ?? existing.immune_yesterday_count,
  };
}

function latestTimestamp(a: string | null, b: string): string {
  if (!a) return b;
  return b > a ? b : a;
}

export default function App() {
  const [subnets, setSubnets] = useState<SubnetSummary[]>(STATIC_SUBNETS);
  const [activeNetuid, setActiveNetuid] = useState(readStoredNetuid);
  const [tab, setTab] = useState<AppTab>(readStoredTab);
  const [error, setError] = useState<string | null>(null);
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [, setRelativeTick] = useState(0);

  const touchLastUpdated = useCallback((iso: string) => {
    setLastUpdatedAt((prev) => latestTimestamp(prev, iso));
  }, []);

  useEffect(() => {
    storeNetuid(activeNetuid);
  }, [activeNetuid]);

  useEffect(() => {
    storeTab(tab);
  }, [tab]);

  useEffect(() => {
    if (!lastUpdatedAt) return;
    const id = setInterval(() => setRelativeTick((tick) => tick + 1), 30_000);
    return () => clearInterval(id);
  }, [lastUpdatedAt]);

  useEffect(() => {
    api
      .health()
      .then((health) => setApiConfigured(health.taostats_configured))
      .catch(() => setApiConfigured(false));
  }, []);

  const mergeOverviewStats = useCallback(
    (overview: SubnetOverview) => {
      touchLastUpdated(overview.updated_at);
      setSubnets((prev) =>
        prev.map((s) =>
          s.netuid === overview.netuid
            ? mergeSubnetStats(s, {
                ...s,
                incentive_burn: overview.incentive_burn,
                registration_fee: overview.registration_fee,
                immune_today_count: overview.immune_today_count,
                immune_yesterday_count: overview.immune_yesterday_count,
              })
            : s,
        ),
      );
    },
    [touchLastUpdated],
  );

  const mergeTagStats = useCallback(
    (stats: SubnetSummary) => {
      setSubnets((prev) =>
        prev.map((s) => (s.netuid === stats.netuid ? mergeSubnetStats(s, stats) : s)),
      );
      touchLastUpdated(new Date().toISOString());
    },
    [touchLastUpdated],
  );

  const loadTagStats = useCallback(async (allSubnets = false, refresh = false) => {
    const order = allSubnets
      ? [
          activeNetuid,
          ...STATIC_SUBNETS.map((s) => s.netuid).filter((id) => id !== activeNetuid),
        ]
      : [activeNetuid];
    for (const netuid of order) {
      try {
        const stats = await api.getTagStats(netuid, { refresh });
        mergeTagStats(stats);
      } catch {
        /* try next subnet */
      }
    }
  }, [activeNetuid, mergeTagStats]);

  useEffect(() => {
    if (apiConfigured !== true) return;

    let cancelled = false;

    api
      .listSubnets()
      .then((list) => {
        if (cancelled) return;
        setSubnets((prev) =>
          list.map((subnet) => {
            const existing = prev.find((s) => s.netuid === subnet.netuid);
            return existing ? mergeSubnetStats(existing, subnet) : subnet;
          }),
        );
      })
      .catch(() => {
        /* static subnet list is already shown */
      });

    const loadTags = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      if (cancelled) return;
      await loadTagStats(false, false);
    };

    loadTags();
    const interval = setInterval(() => loadTagStats(true, false), DATA_REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [apiConfigured, loadTagStats]);

  const handleManualRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const list = await api.listSubnets({ refresh: true });
      setSubnets((prev) =>
        list.map((subnet) => {
          const existing = prev.find((s) => s.netuid === subnet.netuid);
          return existing ? mergeSubnetStats(existing, subnet) : subnet;
        }),
      );
      await loadTagStats(true, true);
      touchLastUpdated(new Date().toISOString());
      setReloadToken((token) => token + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }, [loadTagStats, touchLastUpdated]);

  const activeSubnet = subnets.find((s) => s.netuid === activeNetuid) ?? subnets[0];

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-8 md:px-6">
      <header className="mb-8 flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-violet-300/80">Bittensor</p>
          <h1 className="text-3xl font-bold text-white md:text-4xl">Miner Dashboard</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">
            Miner rankings and emissions for SN15 (ORO), SN23 (Trishool), and SN83 (CliqueAI).
          </p>
          {lastUpdatedAt ? (
            <p className="mt-2 text-xs text-slate-500" title={formatTime(lastUpdatedAt)}>
              Last updated {formatRelativeTime(lastUpdatedAt)}
              <span className="text-slate-600">
                {" "}
                · auto-refresh every {Math.round(DATA_REFRESH_INTERVAL_MS / 60_000)} min
              </span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing || apiConfigured !== true}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-sky-400/40 hover:text-white disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "Refresh now"}
          </button>
          <button
            type="button"
            onClick={() => setTab("subnets")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === "subnets"
                ? "bg-white text-slate-950"
                : "border border-white/10 text-slate-300"
            }`}
          >
            Subnets
          </button>
          <button
            type="button"
            onClick={() => setTab("rankings")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === "rankings"
                ? "bg-white text-slate-950"
                : "border border-white/10 text-slate-300"
            }`}
          >
            Rankings
          </button>
          <button
            type="button"
            onClick={() => setTab("wallet")}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === "wallet"
                ? "bg-white text-slate-950"
                : "border border-white/10 text-slate-300"
            }`}
          >
            Wallet
          </button>
        </div>
      </header>

      {apiConfigured === false ? (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Set <span className="mono">TAOSTATS_API_KEY</span> in{" "}
          <span className="mono">backend/.env</span> to load live chain data. Get a free key at{" "}
          <a
            className="text-amber-200 underline"
            href="https://taostats.io/pro"
            target="_blank"
            rel="noreferrer"
          >
            taostats.io/pro
          </a>
          .
        </div>
      ) : null}

      {error ? (
        <div className="mb-6 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      {tab === "wallet" ? (
        <WalletPanel />
      ) : tab === "rankings" ? (
        <SubnetRankingsPanel
          onSelectSubnet={(netuid) => {
            setActiveNetuid(netuid);
            setTab("subnets");
          }}
        />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            {subnets.map((subnet) => (
              <button
                key={subnet.netuid}
                type="button"
                onClick={() => setActiveNetuid(subnet.netuid)}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  activeNetuid === subnet.netuid
                    ? "border-sky-400/50 bg-sky-500/10"
                    : "border-white/10 bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <p className="text-xs uppercase tracking-wide text-slate-400">SN{subnet.netuid}</p>
                <p className="font-medium text-white">{subnet.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Burn{" "}
                  {subnet.incentive_burn != null ? formatPercent(subnet.incentive_burn) : "…"}
                  {" · "}
                  fee{" "}
                  {subnet.registration_fee != null
                    ? `${formatTao(subnet.registration_fee)} τ`
                    : "…"}
                  {" · "}
                  [{subnet.immune_today_count ?? "…"}, {subnet.immune_yesterday_count ?? "…"}]
                </p>
              </button>
            ))}
          </div>

          {activeSubnet ? (
            <SubnetDashboard
              netuid={activeSubnet.netuid}
              summary={activeSubnet}
              reloadToken={reloadToken}
              onOverviewLoaded={mergeOverviewStats}
              onDataUpdated={touchLastUpdated}
            />
          ) : (
            <div className="rounded-xl border border-white/10 p-8 text-center text-slate-400">
              Loading subnets…
            </div>
          )}
        </>
      )}
    </div>
  );
}
