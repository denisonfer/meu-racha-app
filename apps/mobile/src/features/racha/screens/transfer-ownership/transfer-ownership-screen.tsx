import { ConfirmBottomSheet, NoticeBanner } from "@/ui/components";
import {
  PIX_TRANSFER_TITLE,
  pixTransferText,
} from "../../utils/racha-messages";
import { useTransferOwnershipScreen } from "./use-transfer-ownership-screen";

export const TransferOwnershipScreen = () => {
  const {
    hasPixKey,
    isPixKeyLoading,
    rachaName,
    name,
    isTransferring,
    failureMessage,
    confirm,
    cancel,
  } = useTransferOwnershipScreen();

  if (!name || !rachaName) return null;

  return (
    <ConfirmBottomSheet
      title={`Passar ${rachaName} para ${name}?`}
      message={`${name} vira dono e você vira admin. Só volta a ser seu se a pessoa passar de volta.`}
      confirmLabel="Passar o racha"
      busyLabel="Passando"
      isBusy={isTransferring}
      isConfirmDisabled={isPixKeyLoading}
      failureMessage={failureMessage}
      onConfirm={confirm}
      onCancel={cancel}
    >
      {hasPixKey ? (
        <NoticeBanner
          tone="warning"
          title={PIX_TRANSFER_TITLE}
          text={pixTransferText(name)}
        />
      ) : null}
    </ConfirmBottomSheet>
  );
};
