import { CaretDownIcon } from "phosphor-react-native";
import { Pressable } from "react-native";

import { showGroupPicker } from "@/components/ui/group-picker";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import type { RequestListScope, RequestScopeGroup } from "@/lib/local-store";

/** The groups the viewer sees in full, then "Mine". Hidden when there is no such group. */
export function ScopeMenu({
  groups,
  selected,
  onChange,
}: {
  groups: RequestScopeGroup[];
  selected: RequestScopeGroup | null;
  onChange: (scope: RequestListScope) => void;
}) {
  const { t } = useTranslation();
  if (groups.length === 0) return null;

  const label = selected?.groupName ?? t.requests.scopeMine;

  const open = () =>
    showGroupPicker(
      {
        title: t.requests.scopeLabel,
        groups,
        cancelLabel: t.account.cancel,
        mineLabel: t.requests.scopeMine,
      },
      onChange
    );

  return (
    <Pressable
      testID="requests-scope"
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`${t.requests.scopeLabel}: ${label}`}
      className="shrink flex-row items-center gap-1 rounded-full border border-input bg-card px-3 py-1.5 active:opacity-70"
    >
      <Text className="shrink text-[14px] font-semibold text-foreground" numberOfLines={1}>
        {label}
      </Text>
      <Icon icon={CaretDownIcon} tone="faint" size={12} weight="bold" />
    </Pressable>
  );
}
