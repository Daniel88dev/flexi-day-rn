import { View } from "react-native";

import { TABULAR, Text } from "@/components/ui/text";
import type { TimelineStrip as Strip } from "@/lib/attendance";
import { cn } from "@/lib/cn";

const percent = (fraction: number) => `${fraction * 100}%` as const;

export function TimelineStrip({ strip }: { strip: Strip }) {
  return (
    <View className="gap-1.5" testID="timeline-strip">
      <View className="h-7 overflow-hidden rounded-[12px] bg-muted">
        {strip.spans.map((span) => (
          <View
            key={`${span.kind}-${span.from}`}
            testID={`timeline-${span.kind}`}
            className={cn("absolute top-0 bottom-0", span.kind === "work" ? "bg-ok" : "bg-warm")}
            style={{
              left: percent(span.from),
              // A span under a pixel still shows as one.
              width: percent(Math.max(span.to - span.from, 0.004)),
            }}
          />
        ))}
        {strip.now !== null ? (
          <View
            testID="timeline-now"
            className="absolute top-0 bottom-0 w-[2px] bg-foreground"
            style={{ left: percent(Math.min(strip.now, 0.995)) }}
          />
        ) : null}
      </View>
      <View className="h-4">
        {strip.ticks.map((tick) => (
          <Text
            key={tick.at}
            className="absolute w-10 text-[10.5px] text-faint"
            style={[
              TABULAR,
              // A label on either edge sits inside the strip rather than hanging past it.
              tick.at <= 0
                ? { left: 0 }
                : tick.at >= 1
                  ? { right: 0, textAlign: "right" }
                  : { left: percent(tick.at), marginLeft: -20, textAlign: "center" },
            ]}
          >
            {tick.label}
          </Text>
        ))}
      </View>
    </View>
  );
}
