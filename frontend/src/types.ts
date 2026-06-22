export interface HealthResponse {
  status: string;
  network: string;
  subnets: number[];
  taostats_configured: boolean;
}

export interface SubnetSummary {
  netuid: number;
  name: string;
  description: string;
  dashboard_url: string;
  incentive_burn?: number;
  registration_fee?: number;
  immune_registration_count?: number;
  immune_today_count?: number | null;
  immune_yesterday_count?: number | null;
}

export interface SubnetOverview {
  netuid: number;
  name: string;
  description: string;
  dashboard_url: string;
  block: number;
  total_neurons: number;
  validator_count: number;
  miner_count: number;
  total_stake: number;
  total_emission: number;
  total_daily_income: number;
  avg_incentive: number;
  incentive_burn: number;
  registration_fee: number;
  immune_registration_count: number;
  immune_today_count?: number | null;
  immune_yesterday_count?: number | null;
  updated_at: string;
}

export interface NeuronRecord {
  uid: number;
  hotkey: string;
  coldkey: string;
  stake: number;
  trust: number;
  consensus: number;
  incentive: number;
  dividends: number;
  emission: number;
  daily_income: number;
  validator_trust: number;
  is_validator: boolean;
  is_serving: boolean;
  rank: number | null;
  active: boolean;
}

export interface SubnetNeuronsResponse {
  netuid: number;
  name: string;
  block: number;
  neurons: NeuronRecord[];
  updated_at: string;
}

export interface SubnetDashboardResponse {
  overview: SubnetOverview;
  neurons: NeuronRecord[];
  block: number;
  updated_at: string;
}

export interface SubnetRankingsResponse {
  rankings: SubnetRankingEntry[];
  updated_at: string;
}

export interface SubnetRankingEntry {
  rank: number;
  netuid: number;
  name: string;
  incentive_burn: number;
  miner_daily_total: number;
  registration_fee: number;
  tracked: boolean;
}

export interface WalletBalance {
  address: string;
  free_tao: number;
  network: string;
  updated_at: string;
}

export interface PortfolioEntry {
  netuid: number;
  name: string;
  uid: number | null;
  hotkey: string | null;
  stake: number;
  emission: number;
  daily_income: number;
  incentive: number;
  role: string;
}

export interface PortfolioResponse {
  address: string;
  network: string;
  free_tao: number;
  entries: PortfolioEntry[];
  updated_at: string;
}
