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
  avg_incentive: number;
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
