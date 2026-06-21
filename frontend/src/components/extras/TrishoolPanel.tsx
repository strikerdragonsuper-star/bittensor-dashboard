import { useEffect, useState } from "react";
import { api } from "../../api/client";
import type { TrishoolPlatformInfo } from "../../types/extras";
import { ErrorText, PanelShell } from "./OroPanel";

export function TrishoolPanel() {
  const [data, setData] = useState<TrishoolPlatformInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getTrishoolInfo()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load Trishool info"));
  }, []);

  if (error) {
    return (
      <PanelShell title="Trishool platform">
        <ErrorText message={error} />
      </PanelShell>
    );
  }

  if (!data) {
    return <PanelShell title="Trishool platform">Loading…</PanelShell>;
  }

  return (
    <PanelShell title="Trishool platform" hint="Off-chain scores require validator auth">
      <p className="text-sm text-slate-300">{data.message}</p>
      <a
        href={data.dashboard_url}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex rounded-lg border border-white/10 px-3 py-2 text-sm text-sky-200 hover:border-sky-400/40"
      >
        Open Trishool dashboard ↗
      </a>
      <p className="mt-3 text-xs text-slate-500">
        Use the miner rankings below for on-chain incentive and emission.
      </p>
    </PanelShell>
  );
}
