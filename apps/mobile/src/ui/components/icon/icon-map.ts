import {
  Check,
  ChevronLeft,
  CircleCheck,
  CircleX,
  Eye,
  EyeOff,
} from "lucide-react-native";

export const iconMap = {
  back: ChevronLeft,
  check: Check,
  success: CircleCheck,
  error: CircleX,
  eye: Eye,
  "eye-off": EyeOff,
} as const;

export type TIconName = keyof typeof iconMap;
