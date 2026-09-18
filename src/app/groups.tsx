import { StackScreen } from "@/components/shell/stack-screen";
import { useTranslation } from "@/i18n/use-translation";

export default function Screen() {
  const { t } = useTranslation();
  return <StackScreen title={t.nav.groups} />;
}
