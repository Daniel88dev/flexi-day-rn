import { MapPinIcon } from "phosphor-react-native";
import { ActivityIndicator, View } from "react-native";

import { Icon, useTone } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { formatRadius, type LocationStatus } from "@/lib/attendance";

export function LocationLine({ status }: { status?: LocationStatus }) {
  const { t } = useTranslation();
  const muted = useTone("muted");
  if (!status || status.kind === "hidden") return null;

  const copy = t.clockLocation;
  const radius = (metres: number) => formatRadius(metres, t.common.locale);
  const working = status.kind === "finding" || status.kind === "sharpening";
  const label =
    status.kind === "finding"
      ? copy.finding
      : status.kind === "sharpening"
        ? copy.sharpening(radius(status.accuracy))
        : status.kind === "approximate"
          ? copy.approximate
          : (status.end === "IN" ? copy.savedIn : copy.savedOut)(radius(status.accuracy));

  return (
    <View
      className="-mt-1 flex-row items-center justify-center gap-1.5"
      accessibilityLiveRegion="polite"
      testID="clock-location"
    >
      {working ? (
        <ActivityIndicator size="small" color={muted} style={{ transform: [{ scale: 0.75 }] }} />
      ) : (
        <Icon icon={MapPinIcon} tone="ok" size={15} weight="bold" />
      )}
      <Text className="text-[13px] text-muted-foreground">{label}</Text>
    </View>
  );
}
