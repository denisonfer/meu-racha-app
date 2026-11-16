import { Screen } from "@/ui/components";
import { PRO_TITLE } from "../../utils/plan-messages";
import { PlanOffer } from "./plan-offer";
import { PlanStatus } from "./plan-status";
import { usePlanScreen } from "./use-plan-screen";

// com o diálogo da Play aberto, o voltar não faz nada (PLB5)
const stay = () => {};

export const PlanScreen = () => {
  const screen = usePlanScreen();

  return (
    <Screen
      canGoBack
      title={PRO_TITLE}
      onGoBack={screen.isBuying ? stay : undefined}
    >
      {screen.mode === "status" ? (
        screen.status ? (
          <PlanStatus
            title={screen.status.title}
            detail={screen.status.detail}
            hasBillingIssue={screen.status.hasBillingIssue}
            canManage={screen.canManage}
            onManage={screen.manage}
            canRestore={screen.canRestore}
            isRestoring={screen.isRestoring}
            onRestore={screen.restore}
          />
        ) : null
      ) : (
        <PlanOffer
          isAvailable={screen.mode === "offer"}
          isIos={screen.isIos}
          phase={screen.phase}
          options={screen.options}
          selected={screen.selected}
          onSelect={screen.selectPlan}
          ctaTitle={screen.ctaTitle}
          renewal={screen.renewal}
          isBuying={screen.isBuying}
          isDeclined={screen.isDeclined}
          onBuy={screen.buy}
          onRetryLoad={screen.retryLoad}
          onRetryActivation={screen.retryActivation}
          isRestoring={screen.isRestoring}
          onRestore={screen.restore}
          onTerms={screen.openTerms}
          onPrivacy={screen.openPrivacy}
        />
      )}
    </Screen>
  );
};
