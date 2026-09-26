import { Pressable, ScrollView } from "react-native";

import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import { filterLabel, REQUEST_FILTERS, type RequestFilter } from "@/lib/requests/filters";

export function FilterChips({
  value,
  counts,
  onChange,
}: {
  value: RequestFilter;
  counts: Record<RequestFilter, number>;
  onChange: (filter: RequestFilter) => void;
}) {
  const { t } = useTranslation();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
    >
      {REQUEST_FILTERS.map((filter) => {
        const selected = filter === value;
        return (
          <Pressable
            key={filter}
            testID={`requests-filter-${filter}`}
            onPress={() => onChange(filter)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className={cn(
              "flex-row items-center gap-1.5 rounded-full border px-3.5 py-2 active:opacity-80",
              selected ? "border-primary bg-primary" : "border-border bg-card"
            )}
          >
            <Text
              className={cn(
                "text-[14px] font-semibold",
                selected ? "text-primary-foreground" : "text-foreground"
              )}
            >
              {filterLabel(filter, t)}
            </Text>
            <Text
              className={cn(
                "text-[13px] font-semibold",
                selected ? "text-primary-foreground" : "text-faint"
              )}
            >
              {counts[filter]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
