import { ReportSheet } from "./report-sheet";
import { useReportProfileSheet } from "./use-report-profile-sheet";

export const ReportProfileSheetScreen = () => {
  const target = useReportProfileSheet();

  return target ? <ReportSheet target={target} /> : null;
};
