import { useState } from "react";
import { api } from "../api/client";
import type { PortfolioResponse, WalletBalance } from "../types";
import { formatTao, truncateKey } from "../utils/format";

export function WalletPanel() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);

  async function lookup() {
    const trimmed = address.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    try {
      const [balanceResult, portfolioResult] = await Promise.all([
        api.getBalance(trimmed),
        api.getPortfolio(trimmed),
      ]);
      setBalance(balanceResult);
      setPortfolio(portfolioResult);
    } catch (err) {
      setBalance(null);
      setPortfolio(null);
      setError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="text-xs uppercase tracking-[0.14em] text-slate-400">
            Wallet address (coldkey or hotkey)
          </label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
            placeholder="5..."
            className="mono mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none ring-sky-400/40 focus:ring"
          />
        </div>
        <button
          type="button"
          onClick={lookup}
          disabled={loading || !address.trim()}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Looking up…" : "Lookup"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

      {balance ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Free balance</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {formatTao(balance.free_tao)} τ
            </p>
            <p className="mono mt-1 text-xs text-slate-500">{truncateKey(balance.address, 10, 8)}</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Miner positions</p>
            <p className="mt-2 text-2xl font-semibold text-white">
              {portfolio?.entries.length ?? 0}
            </p>
            <p className="mt-1 text-xs text-slate-500">Miner UIDs on SN15, SN23, SN74, SN83</p>
          </div>
        </div>
      ) : null}

      {portfolio && portfolio.entries.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Subnet</th>
                <th className="px-4 py-3">UID</th>
                <th className="px-4 py-3">Stake</th>
                <th className="px-4 py-3">Emission</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.entries.map((entry) => (
                <tr key={`${entry.netuid}-${entry.uid}`} className="border-b border-white/5">
                  <td className="px-4 py-3 text-white">
                    SN{entry.netuid} · {entry.name}
                  </td>
                  <td className="px-4 py-3">{entry.uid}</td>
                  <td className="px-4 py-3">{formatTao(entry.stake)} τ</td>
                  <td className="px-4 py-3">{formatTao(entry.emission, 6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
