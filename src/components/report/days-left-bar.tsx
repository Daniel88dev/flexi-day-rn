import { useState } from "react";
import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import { useTone } from "@/components/ui/icon";
import type { CalendarRecordType } from "@/lib/local-store";
import { roundedRightRect, type DaysLeftScale, type MemberRemaining } from "@/lib/report";

import { useLeaveColor } from "./leave-color";

const HEIGHT = 6;

/**
 * One person's days left on the list's shared scale: carry-over light, the year's grant solid,
 * and an overdraft in red left of zero.
 */
export function DaysLeftBar({
  row,
  scale,
  type,
}: {
  row: MemberRemaining;
  scale: DaysLeftScale;
  type: CalendarRecordType;
}) {
  const [width, setWidth] = useState(0);
  const color = useLeaveColor(type);
  const danger = useTone("danger");

  const perDay = width / Math.max(1, scale.left + scale.over);
  const zero = scale.over * perDay;
  const carry = row.carriedOverLeft * perDay;
  const year = row.yearLeft * perDay;
  const over = -row.overdraft * perDay;

  return (
    <View
      onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}
      style={{ height: HEIGHT }}
      className="mt-1.5"
    >
      {width > 0 ? (
        <Svg width={width} height={HEIGHT}>
          <Rect
            x={0}
            y={0}
            width={width}
            height={HEIGHT}
            rx={HEIGHT / 2}
            fill={color}
            opacity={0.1}
          />
          {carry > 0 ? (
            <Rect x={zero} y={0} width={carry} height={HEIGHT} fill={color} opacity={0.4} />
          ) : null}
          {year > 0 ? (
            <Path d={roundedRightRect(zero + carry, 0, year, HEIGHT, HEIGHT / 2)} fill={color} />
          ) : null}
          {over > 0 ? (
            <Rect
              x={zero - over}
              y={0}
              width={over}
              height={HEIGHT}
              rx={HEIGHT / 2}
              fill={danger}
            />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}
