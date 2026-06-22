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
    default:
      return null;
  }
}
