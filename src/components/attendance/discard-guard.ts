import { useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { ActionSheetIOS } from "react-native";

import { useTranslation } from "@/i18n/use-translation";

/**
 * Asks "Discard changes?" before a page sheet with changes goes, however it goes: Cancel, or a
 * swipe down, which native-stack holds back and hands here while removal is prevented.
 */
export function useDiscardGuard(dirty: boolean) {
  const { t } = useTranslation();
  const navigation = useNavigation();

  usePreventRemove(dirty, ({ data }) => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: t.entry.discardTitle,
        options: [t.entry.discard, t.entry.keepEditing],
        destructiveButtonIndex: 0,
        cancelButtonIndex: 1,
      },
      (index) => {
        if (index === 0) navigation.dispatch(data.action);
      }
    );
  });
}
