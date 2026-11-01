import { render, screen } from "@testing-library/react-native";
import { View } from "react-native";

import { TabHeader } from "@/components/shell/tab-header";

jest.mock("@/components/notifications/notification-bell", () => {
  const { View } = jest.requireActual("react-native");
  return { NotificationBell: () => <View testID="notification-bell" /> };
});

describe("TabHeader", () => {
  it("shows the title beside the bell", async () => {
    await render(<TabHeader title="Requests" />);

    expect(screen.getByText("Requests")).toBeOnTheScreen();
    expect(screen.getByTestId("notification-bell")).toBeOnTheScreen();
  });

  it("puts controls on either side of the bell", async () => {
    await render(
      <TabHeader
        title="Requests"
        beforeBell={<View testID="before" />}
        afterBell={<View testID="after" />}
      />
    );

    const order = screen
      .getAllByTestId(/^(before|notification-bell|after)$/)
      .map((node) => node.props.testID);
    expect(order).toEqual(["before", "notification-bell", "after"]);
  });
});
