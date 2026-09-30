import { useEffect } from "react";
import { clearPendingDestination } from "@/features/auth";
import { JoinRachaScreen } from "@/features/racha";

export default function Invite() {
  useEffect(() => {
    void clearPendingDestination();
  }, []);

  return <JoinRachaScreen />;
}
