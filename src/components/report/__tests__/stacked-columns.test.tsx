import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactTestRendererJSON } from "react-test-renderer";

import { StackedColumns, type Segment } from "@/components/report/stacked-columns";
import { Text } from "@/components/ui/text";
import { TranslationProvider } from "@/i18n/use-translation";
import { trailingMonths } from "@/lib/report";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));

type Shape = { type: string; fill?: string; opacity?: number; d?: string };

const hex = (fill?: { payload: number }) =>
  fill ? `#${(fill.payload & 0xffffff).toString(16).padStart(6, "0")}` : undefined;
const SERIES = ["#111111", "#222222"];

function shapes(node: ReactTestRendererJSON | ReactTestRendererJSON[] | null): Shape[] {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(shapes);
  const own =
    node.type === "RNSVGRect" || node.type === "RNSVGPath"
      ? [
          {
            type: node.type,
            fill: hex(node.props.fill),
            opacity: node.props.opacity,
            d: node.props.d,
          },
        ]
      : [];
  const children = (node.children ?? []).filter(
    (child): child is ReactTestRendererJSON => typeof child !== "string"
  );
  return [...own, ...children.flatMap(shapes)];
}

const slots = trailingMonths(new Date(2026, 1, 16)).slice(-3);
const columns: Segment[][] = [
  [
    { key: "a", value: 2, color: "#111111" },
    { key: "b", value: 1, color: "#222222" },
  ],
  [{ key: "a", value: 0, color: "#111111" }],
  [{ key: "b", value: 4, color: "#222222" }],
];

async function renderColumns(
  selected: number | null,
  onSelect = jest.fn(),
  extra: { columns?: Segment[][]; guide?: { value: number; color: string } } = {}
) {
  await render(
    <TranslationProvider>
      <StackedColumns
        testID="chart"
        slots={slots}
        columns={extra.columns ?? columns}
        selected={selected}
        onSelect={onSelect}
        label={(index) => `column ${index}`}
        callout={(index) => <Text>callout {index}</Text>}
        guide={extra.guide}
      />
    </TranslationProvider>
  );
  await fireEvent(screen.getByTestId("chart"), "layout", {
    nativeEvent: { layout: { width: 204, height: 168, x: 0, y: 0 } },
  });
  return onSelect;
}

describe("StackedColumns", () => {
  it("renders each column's segments bottom up with a rounded top on the last one", async () => {
    await renderColumns(null);

    const bars = shapes(screen.toJSON()).filter((shape) => SERIES.includes(shape.fill ?? ""));
    expect(bars.map((bar) => [bar.type, bar.fill])).toEqual([
      ["RNSVGRect", "#111111"],
      ["RNSVGPath", "#222222"],
      ["RNSVGPath", "#222222"],
    ]);
    expect(bars.every((bar) => bar.opacity === 1)).toBe(true);
    expect(screen.getByText("Dec")).toBeOnTheScreen();
    expect(screen.getByText("Jan")).toBeOnTheScreen();
    expect(screen.getByText("'26")).toBeOnTheScreen();
  });

  it("renders the other columns dimmed while one is selected", async () => {
    await renderColumns(2);

    const bars = shapes(screen.toJSON()).filter((shape) => SERIES.includes(shape.fill ?? ""));
    expect(bars.map((bar) => bar.opacity)).toEqual([0.35, 0.35, 1]);
    expect(screen.getByTestId("chart-col-2")).toHaveProp("accessibilityState", { selected: true });
  });

  it("selects a column on a tap and clears it on a tap of the selected one", async () => {
    const onSelect = await renderColumns(null);
    await fireEvent.press(screen.getByTestId("chart-col-1"));
    expect(onSelect).toHaveBeenLastCalledWith(1);

    await renderColumns(1, onSelect);
    await fireEvent.press(screen.getByTestId("chart-col-1"));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it("renders a segment's own opacity, dimmed with its column", async () => {
    const light: Segment[][] = [
      [
        { key: "a", value: 2, color: "#111111" },
        { key: "b", value: 1, color: "#111111", opacity: 0.4 },
      ],
      [{ key: "a", value: 1, color: "#111111", opacity: 0.4 }],
      [],
    ];

    await renderColumns(null, jest.fn(), { columns: light });
    let bars = shapes(screen.toJSON()).filter((shape) => shape.fill === "#111111");
    expect(bars.map((bar) => bar.opacity)).toEqual([1, 0.4, 0.4]);

    await renderColumns(0, jest.fn(), { columns: light });
    bars = shapes(screen.toJSON()).filter((shape) => shape.fill === "#111111");
    expect(bars.map((bar) => bar.opacity)).toEqual([1, 0.4, 0.4 * 0.35]);
  });

  it("renders a dashed guide line and scales the axis to reach it", async () => {
    await renderColumns(null, jest.fn(), { guide: { value: 9, color: "#333333" } });

    const guide = screen.getByTestId("chart-guide");
    expect(guide).toHaveProp("strokeDasharray", ["5", "4"]);
    expect(hex(guide.props.stroke)).toBe("#333333");
    // 9 on a 0 to 10 axis over a 138 px plot with 8 px of headroom.
    expect(guide).toHaveProp("y1", 21);
    expect(screen.getByText("10")).toBeOnTheScreen();
  });

  it("renders no guide line for a guide of zero or none", async () => {
    await renderColumns(null, jest.fn(), { guide: { value: 0, color: "#333333" } });
    expect(screen.queryByTestId("chart-guide")).toBeNull();

    await renderColumns(null);
    expect(screen.queryByTestId("chart-guide")).toBeNull();
  });

  it("renders its pressable columns before it knows its width", async () => {
    await render(
      <TranslationProvider>
        <StackedColumns
          testID="chart"
          slots={slots}
          columns={columns}
          selected={null}
          onSelect={jest.fn()}
          label={(index) => `column ${index}`}
          callout={() => null}
        />
      </TranslationProvider>
    );

    expect(screen.getByTestId("chart-col-0")).toHaveProp("accessibilityLabel", "column 0");
    expect(shapes(screen.toJSON())).toEqual([]);
  });
});
