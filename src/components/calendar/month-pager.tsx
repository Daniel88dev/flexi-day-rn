import { useEffect, useRef, type ReactElement } from "react";
import { FlatList } from "react-native";

import type { YearMonth } from "@/lib/requests/months";

/**
 * A paged horizontal list of months. Only a finger decides the month from here: a stepper tap
 * scrolls the list too and ends in the same momentum event, which must not echo back.
 */
export function MonthPager({
  months,
  index,
  onIndex,
  width,
  height,
  extraData,
  renderMonth,
}: {
  months: readonly YearMonth[];
  index: number;
  onIndex: (index: number) => void;
  width: number;
  height: number;
  extraData: unknown;
  renderMonth: (month: YearMonth) => ReactElement;
}) {
  const listRef = useRef<FlatList<YearMonth>>(null);
  const draggedRef = useRef(false);

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: index * width, animated: true });
  }, [index, width]);

  return (
    <FlatList
      testID="calendar-pager"
      ref={listRef}
      data={months}
      extraData={extraData}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      initialScrollIndex={index}
      getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
      initialNumToRender={1}
      maxToRenderPerBatch={1}
      windowSize={3}
      keyExtractor={(month) => `${month.year}-${month.month}`}
      style={{ height, flexGrow: 0 }}
      onScrollBeginDrag={() => {
        draggedRef.current = true;
      }}
      onMomentumScrollEnd={(event) => {
        if (!draggedRef.current) return;
        draggedRef.current = false;
        onIndex(Math.round(event.nativeEvent.contentOffset.x / width));
      }}
      renderItem={({ item }) => renderMonth(item)}
    />
  );
}
