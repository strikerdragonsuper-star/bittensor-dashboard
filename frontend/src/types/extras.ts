export interface OroTopAgent {
  top_miner_hotkey: string | null;
  top_score: number;
  top_agent_version_id: string | null;
  computed_at: string | null;
}

export interface OroRaceSummary {
  race_id: string;
  race_number: number | null;
  status: string;
  winner_agent_name: string | null;
  winner_score: number | null;
  qualifier_count: number | null;
  race_completed_at: string | null;
}

export interface OroQualifier {
  rank: number;
  agent_name: string | null;
  miner_hotkey: string | null;
  qualifying_score: number | null;
  race_score: number | null;
  race_rank: number | null;
}

export interface OroLeaderboard {
  top_agent: OroTopAgent;
  recent_races: OroRaceSummary[];
  latest_race_qualifiers: OroQualifier[];
  latest_race_id: string | null;
  updated_at: string;
}

export interface TrishoolPlatformInfo {
  available: boolean;
  dashboard_url: string;
  message: string;
  weights: Record<string, number> | null;
}

export interface GittensorAllocationRow {
  repository_full_name: string;
  emission_share: number;
  total_reward: number;
  pr_score: number;
}

export interface GittensorScore {
  success: boolean;
  total_score: number;
  blended_reward: number;
  github_id: string | null;
  hotkey: string | null;
  is_eligible: boolean;
  merged_prs: number;
  allocation: GittensorAllocationRow[];
  failed_reason: string | null;
  updated_at: string;
}

export interface CliqueMinerScore {
  uid: number;
  hotkey: string;
  reward: number;
  optimality: number;
  diversity: number;
}

export interface CliqueRunSummary {
  run_id: string;
  run_name: string | null;
  created_at: string | null;
  problem_type: string | null;
  difficulty: number | null;
  miner_count: number;
  top_miners: CliqueMinerScore[];
}

export interface CliqueRuns {
  runs: CliqueRunSummary[];
  dashboard_url: string;
  updated_at: string;
}
