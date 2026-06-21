import type { SubnetSummary } from "./types";

/** Static subnet metadata — shown immediately while API loads. */
export const SUBNETS: SubnetSummary[] = [
  {
    netuid: 15,
    name: "ORO",
    description: "AI shopping agents evaluated on ShoppingBench",
    dashboard_url: "https://oroagents.com",
  },
  {
    netuid: 23,
    name: "Trishool",
    description: "AI guard / adversarial prompt evaluation",
    dashboard_url: "https://trishool.ai/dashboard",
  },
  {
    netuid: 83,
    name: "CliqueAI",
    description: "Distributed maximum-clique solver network",
    dashboard_url: "https://wandb.ai/toptensor-ai/CliqueAI",
  },
];
