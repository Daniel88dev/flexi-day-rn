import { CloudSlashIcon, MagnifyingGlassIcon, WarningCircleIcon } from "phosphor-react-native";
import { Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";

const ROWS = [0.55, 0.4, 0.62, 0.48, 0.35];

export function DirectorySkeleton() {
  const { t } = useTranslation();
  return (
    <View
      testID="directory-loading"
      accessible
      accessibilityLabel={t.directory.loading}
      className="mt-4 rounded-[24px] bg-card"
    >
      {ROWS.map((share, index) => (
        <View
          key={share}
          className={cn(
            "flex-row items-center gap-3 px-4 py-3.5",
            index > 0 && "border-t border-border"
          )}
        >
          <View className="h-10 w-10 rounded-full bg-muted" />
          <View className="flex-1 gap-2">
            <View style={{ width: `${share * 100}%` }} className="h-3.5 rounded-full bg-muted" />
            <View style={{ width: `${share * 70}%` }} className="h-3 rounded-full bg-muted" />
          </View>
        </View>
      ))}
    </View>
  );
}

/** The directory is never kept on the phone, so without the server there is nothing to show. */
export function DirectoryOffline({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <View testID="directory-offline" className="mt-4 gap-3">
      <View className="flex-row gap-3 rounded-[16px] bg-danger-soft px-4 py-3">
        <Icon icon={CloudSlashIcon} tone="danger" size={20} />
        <Text className="flex-1 text-[14px] leading-5 text-danger">{t.directory.offline}</Text>
      </View>
      <Pressable
        testID="directory-retry"
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={t.directory.retry}
        className="h-11 justify-center self-start rounded-full border border-border bg-card px-5 active:opacity-70"
      >
        <Text className="text-[15px] font-semibold text-foreground">{t.directory.retry}</Text>
      </Pressable>
    </View>
  );
}

export function DirectoryNoMatch({ onClear }: { onClear: () => void }) {
  const { t } = useTranslation();
  return (
    <View testID="directory-no-match" className="items-center gap-2 px-4 py-12">
      <Icon icon={MagnifyingGlassIcon} tone="faint" size={34} />
      <Text className="text-[16px] font-semibold text-foreground">{t.directory.noMatch}</Text>
      <Pressable
        testID="directory-clear-filters"
        onPress={onClear}
        accessibilityRole="button"
        accessibilityLabel={t.directory.clearFilters}
        className="mt-1 h-11 justify-center rounded-full border border-border bg-card px-5 active:opacity-70"
      >
        <Text className="text-[15px] font-semibold text-foreground">
          {t.directory.clearFilters}
        </Text>
      </Pressable>
    </View>
  );
}

export function DirectoryNote({ testID, message }: { testID: string; message: string }) {
  return (
    <View testID={testID} className="items-center px-4 py-12">
      <Text className="text-center text-[15px] text-faint">{message}</Text>
    </View>
  );
}

export function LapsedBanner({
  message,
  adminLine,
}: {
  message: string;
  adminLine: string | null;
}) {
  return (
    <View
      testID="directory-lapsed"
      className="mb-3 flex-row gap-3 rounded-[16px] bg-warm-soft px-4 py-3"
    >
      <Icon icon={WarningCircleIcon} tone="warm" size={20} />
      <View className="flex-1 gap-1">
        <Text className="text-[14px] leading-5 text-foreground">{message}</Text>
        {adminLine ? (
          <Text className="text-[14px] leading-5 text-foreground">{adminLine}</Text>
        ) : null}
      </View>
    </View>
  );
}
