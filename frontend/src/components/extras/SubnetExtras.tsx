import { CliquePanel } from "./CliquePanel";
import { GittensorPanel } from "./GittensorPanel";
import { OroPanel } from "./OroPanel";
import { TrishoolPanel } from "./TrishoolPanel";

interface SubnetExtrasProps {
  netuid: number;
}

export function SubnetExtras({ netuid }: SubnetExtrasProps) {
  switch (netuid) {
    case 15:
      return <OroPanel />;
    case 23:
      return <TrishoolPanel />;
    case 74:
      return <GittensorPanel />;
    case 83:
      return <CliquePanel />;
    default:
      return null;
  }
}
