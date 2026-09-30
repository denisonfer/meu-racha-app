import { useEffect } from "react";
import { clearPendingInvite, JoinRachaScreen } from "@/features/racha";

export default function Invite() {
  useEffect(() => clearPendingInvite(), []);

  return <JoinRachaScreen />;
}
