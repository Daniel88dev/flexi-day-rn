import { render, screen } from "@testing-library/react-native";

import { CalloutRow, Dot } from "@/components/report/callout-row";

describe("CalloutRow", () => {
  it("renders the label, the value and a dot in the colour at its opacity", async () => {
    await render(<CalloutRow color="#7a69d6" colorOpacity={0.38} label="Pending" value="1" />);

    expect(screen.getByText("Pending")).toBeOnTheScreen();
    expect(screen.getByText("1")).toBeOnTheScreen();
    expect(screen.toJSON()).toMatchObject({
      children: [{ props: { style: { backgroundColor: "#7a69d6", opacity: 0.38 } } }, {}, {}],
    });
  });

  it("renders a title row with no value and no dot", async () => {
    await render(<CalloutRow label="July 2026" strong />);

    expect(screen.getByText("July 2026")).toBeOnTheScreen();
    expect(screen.toJSON()).toMatchObject({ children: [{ type: "Text" }] });
  });
});

describe("Dot", () => {
  it("renders fully opaque by default", async () => {
    await render(<Dot color="#3f9a73" />);

    expect(screen.toJSON()).toMatchObject({
      props: { style: { backgroundColor: "#3f9a73", opacity: 1 } },
    });
  });
});
