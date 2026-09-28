import {
  Check,
  ChevronLeft,
  CircleCheck,
  CircleUserRound,
  CircleX,
  Eye,
  EyeOff,
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
} as const;

export type TIconName = keyof typeof iconMap;
