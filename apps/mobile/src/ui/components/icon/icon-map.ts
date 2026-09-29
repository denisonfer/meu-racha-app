import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleUserRound,
  CircleX,
  Eye,
  EyeOff,
  Minus,
  Plus,
  Share,
  Ticket,
  TriangleAlert,
} from "lucide-react-native";
import { NotificationIcon, RachaIcon } from "./brand-icons";

export const iconMap = {
  back: ChevronLeft,
  check: Check,
  success: CircleCheck,
  error: CircleX,
  eye: Eye,
  "eye-off": EyeOff,
  racha: RachaIcon,
  notification: NotificationIcon,
  profile: CircleUserRound,
  minus: Minus,
  plus: Plus,
  alert: TriangleAlert,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  share: Share,
  ticket: Ticket,
} as const;

export type TIconName = keyof typeof iconMap;
