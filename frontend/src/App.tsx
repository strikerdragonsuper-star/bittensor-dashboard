import { useEffect, useState } from "react";
import { api } from "./api/client";
import { SubnetDashboard } from "./components/SubnetDashboard";
import { WalletPanel } from "./components/WalletPanel";
import type { SubnetSummary } from "./types";

export default function App() {
  const [subnets, setSubnets] = useState<SubnetSummary[]>([]);
  const [activeNetuid, setActiveNetuid] = useState<number>(15);
  const [tab, setTab] = useState<"subnets" | "wallet">("subnets");
  const [error, setError] = useState<string | null>(null);
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .health()
      .then((health) => setApiConfigured(health.taostats_configured))
      .catch(() => setApiConfigured(false));

    api
      .listSubnets()
      .then(setSubnets)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load subnets"));
  }, []);

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
        </div>
        <div className="flex gap-2">
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
              </button>
            ))}
          </div>

          {activeSubnet ? (
            <SubnetDashboard netuid={activeSubnet.netuid} summary={activeSubnet} />
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
