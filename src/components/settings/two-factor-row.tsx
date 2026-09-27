import { router } from "expo-router";
import { CaretRightIcon, ShieldCheckeredIcon } from "phosphor-react-native";
import { ActionSheetIOS } from "react-native";

import { Row } from "@/components/settings/grouped-list";
import { Icon } from "@/components/ui/icon";
import { useTranslation } from "@/i18n/use-translation";
import type { TwoFactorFlow } from "@/lib/session/two-factor-settings";
import { useViewer } from "@/lib/viewer/use-viewer";

const openFlow = (flow: TwoFactorFlow) =>
  router.push({ pathname: "/settings/two-factor", params: { flow } });

const MANAGE_FLOWS: readonly TwoFactorFlow[] = ["authenticator", "backupCodes", "disable"];

/** Off opens enable; on offers the three flows the web shows while two-factor is on. */
export function TwoFactorRow() {
  const { t } = useTranslation();
  const copy = t.settings.twoFactor;
  const enabled = useViewer()?.twoFactorEnabled === true;

  const onPress = () => {
    if (!enabled) {
      openFlow("enable");
      return;
    }
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: copy.manage,
        message: copy.manageHint,
        options: [copy.setupTotp, copy.regenerateBackup, copy.disable, copy.cancel],
        destructiveButtonIndex: 2,
        cancelButtonIndex: 3,
      },
      (index) => {
        const flow = MANAGE_FLOWS[index];
        if (flow) openFlow(flow);
      }
    );
  };

  return (
    <Row
      testID="settings-two-factor"
      icon={ShieldCheckeredIcon}
      label={copy.row}
      value={enabled ? copy.on : copy.off}
      onPress={onPress}
      accessory={<Icon icon={CaretRightIcon} tone="faint" size={16} />}
    />
  );
}
