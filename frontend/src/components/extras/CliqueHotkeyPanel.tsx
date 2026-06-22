import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import { DATA_REFRESH_INTERVAL_MS } from "../../config";
import type { CliqueHotkeyStatus } from "../../types/extras";
import {
  addCliqueHotkey,
  readStoredCliqueHotkeys,
  removeCliqueHotkey,
} from "../../utils/preferences";
import { formatPercent, formatRelativeTime, formatTao, truncateKey } from "../../utils/format";
import { ErrorText, PanelShell } from "./OroPanel";

function isLikelyHotkey(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 40 && trimmed.startsWith("5");
}

export function CliqueHotkeyPanel() {
  const [hotkeys, setHotkeys] = useState<string[]>(() => readStoredCliqueHotkeys());
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, CliqueHotkeyStatus>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const loadStatuses = useCallback(async (keys: string[], refresh = false) => {
    if (keys.length === 0) {
      setStatuses({});
      setErrors({});
      return;
    }

    setLoading(true);
    const nextStatuses: Record<string, CliqueHotkeyStatus> = {};
    const nextErrors: Record<string, string> = {};

    await Promise.all(
      keys.map(async (hotkey) => {
        try {
          nextStatuses[hotkey] = await api.getCliqueHotkeyStatus(hotkey, { refresh });
        } catch (err) {
          nextErrors[hotkey] = err instanceof Error ? err.message : "Failed to load status";
        }
      }),
    );

    setStatuses(nextStatuses);
    setErrors(nextErrors);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadStatuses(hotkeys);
    const interval = setInterval(() => loadStatuses(hotkeys), DATA_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [hotkeys, loadStatuses]);

  const registerHotkey = () => {
    const trimmed = input.trim();
    if (!isLikelyHotkey(trimmed)) {
      setInputError("Enter a valid SS58 hotkey (starts with 5, ~48 characters).");
      return;
    }
    setInputError(null);
    const next = addCliqueHotkey(trimmed);
    setHotkeys(next);
    setInput("");
  };

  const unregisterHotkey = (hotkey: string) => {
    const next = removeCliqueHotkey(hotkey);
    setHotkeys(next);
    setStatuses((prev) => {
      const copy = { ...prev };
      delete copy[hotkey];
      return copy;
    });
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[hotkey];
      return copy;
    });
  };

  return (
    <PanelShell
      title="My CliqueAI hotkeys"
      hint="Save hotkeys here to watch on-chain registration and latest W&B round scores"
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="5F… your miner hotkey"
          className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-slate-500"
        />
        <button
          type="button"
          onClick={registerHotkey}
          className="rounded-lg border border-sky-400/40 bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-200 transition hover:bg-sky-500/20"
        >
          Register hotkey
        </button>
      </div>
      {inputError ? <p className="mt-2 text-sm text-rose-300">{inputError}</p> : null}

      {hotkeys.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">
          No hotkeys saved yet. Paste your miner hotkey above to track SN83 status.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {loading && Object.keys(statuses).length === 0 ? (
            <p className="text-sm text-slate-400">Loading hotkey status…</p>
          ) : null}
          {hotkeys.map((hotkey) => (
            <HotkeyStatusCard
              key={hotkey}
              hotkey={hotkey}
              status={statuses[hotkey]}
              error={errors[hotkey]}
              onRemove={() => unregisterHotkey(hotkey)}
              onRefresh={() => loadStatuses([hotkey], true)}
            />
          ))}
        </div>
      )}
    </PanelShell>
  );
}

function HotkeyStatusCard({
  hotkey,
  status,
  error,
  onRemove,
  onRefresh,
}: {
  hotkey: string;
  status?: CliqueHotkeyStatus;
  error?: string;
  onRemove: () => void;
  onRefresh: () => void;
}) {
  if (error) {
    return (
      <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="mono text-sm text-rose-100">{truncateKey(hotkey, 10, 8)}</p>
          <CardActions onRemove={onRemove} onRefresh={onRefresh} />
        </div>
        <ErrorText message={error} />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-400">
        Loading {truncateKey(hotkey, 10, 8)}…
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mono text-sm text-sky-200">{hotkey}</p>
          <p className="mt-1 text-xs text-slate-500" title={status.updated_at}>
            Updated {formatRelativeTime(status.updated_at)}
          </p>
        </div>
        <CardActions onRemove={onRemove} onRefresh={onRefresh} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <StatusBadge
          label={status.registered ? "Registered on SN83" : "Not registered"}
          tone={status.registered ? "ok" : "warn"}
        />
        {status.registered ? (
          <>
            <StatusBadge label={`UID ${status.uid}`} tone="neutral" />
            {status.miner_rank ? (
              <StatusBadge label={`Miner rank #${status.miner_rank}`} tone="neutral" />
            ) : null}
            <StatusBadge
              label={status.is_serving ? "Serving" : "Not serving"}
              tone={status.is_serving ? "ok" : "warn"}
            />
            <StatusBadge
              label={status.active ? "Active" : "Inactive"}
              tone={status.active ? "ok" : "warn"}
            />
          </>
        ) : null}
      </div>

      {status.registered ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Daily income" value={`${formatTao(status.daily_income)} τ`} />
          <Metric label="Stake" value={`${formatTao(status.stake)} τ`} />
          <Metric label="Incentive" value={formatPercent(status.incentive)} />
          <Metric label="Emission" value={`${formatTao(status.emission)} τ`} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-400">
          Registration fee:{" "}
          {status.registration_fee != null ? `${formatTao(status.registration_fee)} τ` : "—"}
        </p>
      )}

      {status.latest_reward != null ? (
        <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Latest W&B round</p>
          <p className="mt-1 text-sm text-slate-300">
            {status.latest_run_name ?? status.latest_run_id ?? "Recent run"}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Metric label="Reward" value={status.latest_reward.toFixed(4)} />
            <Metric
              label="Optimality"
              value={
                status.latest_optimality != null
                  ? formatPercent(status.latest_optimality)
                  : "—"
              }
            />
            <Metric
              label="Diversity"
              value={
                status.latest_diversity != null ? formatPercent(status.latest_diversity) : "—"
              }
            />
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">
          No recent W&B round score found for this hotkey.
        </p>
      )}
    </div>
  );
}

function CardActions({
  onRemove,
  onRefresh,
}: {
  onRemove: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onRefresh}
        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:border-white/20"
      >
        Refresh
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400 hover:border-rose-400/40 hover:text-rose-200"
      >
        Remove
      </button>
    </div>
  );
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "ok" | "warn" | "neutral";
}) {
  const classes =
    tone === "ok"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : tone === "warn"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
        : "border-white/10 bg-white/[0.03] text-slate-300";
  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs ${classes}`}>{label}</span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-white">{value}</p>
    </div>
  );
}
