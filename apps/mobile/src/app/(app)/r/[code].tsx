import { useEffect } from "react";
import { clearPendingInvite, JoinRachaScreen } from "@/features/racha";

// Link do convite (meuracha://r/<código>). Dentro de (app): a sessão é
// garantida pelo layout, que guarda o código quando precisa do login.
export default function Invite() {
  // o Convite abriu: o código guardado já cumpriu o papel
  useEffect(() => clearPendingInvite(), []);

  return <JoinRachaScreen />;
}
