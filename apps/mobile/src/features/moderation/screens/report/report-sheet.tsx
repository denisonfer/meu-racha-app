import { ReportForm } from "./report-form";
import { ReportSent } from "./report-sent";
import { type TReportTarget, useReportSheet } from "./use-report-sheet";

// A mesma tela vira "Denúncia enviada", sem toast: 4 s não cabem "em até 24h".
export const ReportSheet = ({ target }: { target: TReportTarget }) => {
  const { isSent, form, sent } = useReportSheet(target);

  return isSent ? <ReportSent {...sent} /> : <ReportForm {...form} />;
};
