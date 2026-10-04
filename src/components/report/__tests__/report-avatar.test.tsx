import { render, screen } from "@testing-library/react-native";

import { ReportAvatar } from "@/components/report/report-avatar";
import { scopeMember } from "@/test-support/report";

describe("ReportAvatar", () => {
  it("renders the report's initials for the person", async () => {
    await render(<ReportAvatar user={scopeMember({ initials: "FB" })} color="#2a78d6" />);

    expect(screen.getByText("FB")).toBeOnTheScreen();
  });
});
