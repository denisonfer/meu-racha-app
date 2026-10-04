import { BottomSheet } from "@/ui/components";
import { GuestForm } from "./guest-form";
import { useGuestScreen } from "./use-guest-screen";

export const GuestScreen = () => {
  const {
    isMissing,
    values,
    errors,
    asksPositionDetail,
    failureMessage,
    isSaving,
    canSubmit,
    onChange,
    onSubmit,
  } = useGuestScreen();

  if (isMissing) return null;

  return (
    <BottomSheet title="Adicionar avulso" isBusy={isSaving}>
      <GuestForm
        values={values}
        errors={errors}
        asksPositionDetail={asksPositionDetail}
        failureMessage={failureMessage}
        isSaving={isSaving}
        canSubmit={canSubmit}
        onChange={onChange}
        onSubmit={onSubmit}
      />
    </BottomSheet>
  );
};
