import Menu from "reicon-react/icons/Menu";
import Grid from "reicon-react/icons/Grid";
import CreditCard from "reicon-react/icons/CreditCard";
import Database from "reicon-react/icons/Database";
import Key from "reicon-react/icons/Key";
import Server from "reicon-react/icons/Server";
import Settings from "reicon-react/icons/Settings";
import Users from "reicon-react/icons/Users";
import Cloud from "reicon-react/icons/Cloud";
import Layers from "reicon-react/icons/Layers";
import Check from "reicon-react/icons/Check";
import ChevronDown from "reicon-react/icons/ChevronDown";
import ChevronLeft from "reicon-react/icons/ChevronLeft";
import ChevronRight from "reicon-react/icons/ChevronRight";
import User from "reicon-react/icons/User";
import ArrowDoorOut from "reicon-react/icons/ArrowDoorOut";
import Copy from "reicon-react/icons/Copy";
import MoreH from "reicon-react/icons/MoreH";
import Refresh from "reicon-react/icons/Refresh";
import X from "reicon-react/icons/X";
import Plus from "reicon-react/icons/Plus";
import Search from "reicon-react/icons/Search";

const icons = {
  Plus,
  Search,
  Menu: Menu,
  Projects: Grid,
  Billing: CreditCard,
  Storage: Database,
  Keys: Key,
  Servers: Server,
  Settings: Settings,
  Users: Users,
  Cluster: Cloud,
  Services: Layers,
  Check: Check,
  ChevronDown: ChevronDown,
  ChevronLeft: ChevronLeft,
  ChevronRight: ChevronRight,
  Profile: User,
  SignOut: ArrowDoorOut,
  Copy: Copy,
  More: MoreH,
  Refresh: Refresh,
  Close: X,
};

export type IconName = keyof typeof icons;

export default function Icon({ name }: { name: IconName }) {
  const Glyph = icons[name];
  return (
    <span className="ui-icon" aria-hidden="true">
      {/* Reicon uses a 24-unit viewBox: 2 units render as 1.5px at 18px. */}
      <Glyph size={18} strokeWidth={2} focusable="false" />
    </span>
  );
}
