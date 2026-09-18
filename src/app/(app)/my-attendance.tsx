import { ComingSoon } from "@/components/shell/coming-soon";
import { useTranslation } from "@/i18n/use-translation";

export default function Screen() {
  const { t } = useTranslation();
  return <ComingSoon screen={t.nav.myAttendance} />;
}
