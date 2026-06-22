import { CliqueHotkeyPanel } from "./CliqueHotkeyPanel";
import { CliquePanel } from "./CliquePanel";
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
    case 83:
      return (
        <div className="space-y-6">
          <CliqueHotkeyPanel />
          <CliquePanel />
        </div>
      );
    default:
      return null;
  }
}
