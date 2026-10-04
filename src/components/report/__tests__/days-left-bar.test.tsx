import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ReactTestRendererJSON } from "react-test-renderer";

import { DaysLeftBar } from "@/components/report/days-left-bar";
import { remainingFor } from "@/lib/report";
import { scopeMember, summaryRow } from "@/test-support/report";

type Shape = { type: string; x?: number; width?: number; d?: string; opacity?: number };

function shapes(node: ReactTestRendererJSON | ReactTestRendererJSON[] | null): Shape[] {
  if (!node) return [];
  if (Array.isArray(node)) return node.flatMap(shapes);
  const own =
    node.type === "RNSVGRect" || node.type === "RNSVGPath"
      ? [
          {
            type: node.type,
            x: node.props.x,
            width: node.props.width,
            d: node.props.d,
            opacity: node.props.opacity,
          },
        ]
      : [];
  const children = (node.children ?? []).filter(
    (child): child is ReactTestRendererJSON => typeof child !== "string"
  );
  return [...own, ...children.flatMap(shapes)];
}

async function laidOut(width: number) {
  const bar = screen.root;
  if (!bar) throw new Error("The bar did not render");
  await fireEvent(bar, "layout", {
    nativeEvent: { layout: { width, height: 6, x: 0, y: 0 } },
  });
}

describe("DaysLeftBar", () => {
  it("renders the carry-over light and the grant solid from zero on the shared scale", async () => {
    const row = remainingFor(
      scopeMember(),
      [summaryRow({ carriedOverDays: 3, yearQuota: 20, usedToDate: 1 })],
      "VACATION"
    );
    await render(<DaysLeftBar row={row} scale={{ left: 22, over: 2 }} type="VACATION" />);
    await laidOut(240);

    const [track, carry, grant] = shapes(screen.toJSON());
    expect(track).toMatchObject({ type: "RNSVGRect", x: 0, width: 240, opacity: 0.1 });
    expect(carry).toMatchObject({ type: "RNSVGRect", x: 20, width: 20, opacity: 0.4 });
    expect(grant).toMatchObject({ type: "RNSVGPath" });
    expect(grant.d).toMatch(/^M40,0 L237,0/);
  });

  it("renders an overdraft in red left of zero and nothing right of it", async () => {
    const row = remainingFor(
      scopeMember(),
      [summaryRow({ yearQuota: 22, usedToDate: 24 })],
      "VACATION"
    );
    await render(<DaysLeftBar row={row} scale={{ left: 10, over: 2 }} type="VACATION" />);
    await laidOut(120);

    const drawn = shapes(screen.toJSON());
    expect(drawn).toHaveLength(2);
    expect(drawn[1]).toMatchObject({ type: "RNSVGRect", x: 0, width: 20 });
  });

  it("renders nothing before it knows its width", async () => {
    const row = remainingFor(scopeMember(), [summaryRow()], "VACATION");
    await render(<DaysLeftBar row={row} scale={{ left: 25, over: 0 }} type="VACATION" />);

    expect(shapes(screen.toJSON())).toEqual([]);
  });
});
