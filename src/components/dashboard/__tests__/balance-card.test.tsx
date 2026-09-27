import { render, screen } from "@testing-library/react-native";

import { BalanceCard } from "@/components/dashboard/balance-card";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";
import { useBalanceBuckets } from "@/lib/local-store";

jest.mock("expo-localization", () => ({ getLocales: () => [{ languageCode: "en" }] }));
jest.mock("@/lib/local-store", () => ({ useBalanceBuckets: jest.fn() }));

const buckets = useBalanceBuckets as jest.Mock;

function renderCard(year = 2026) {
  return render(
    <TranslationProvider>
      <BalanceCard year={year} />
    </TranslationProvider>
  );
}

beforeEach(() => jest.clearAllMocks());

describe("BalanceCard", () => {
  it("renders each allocated allowance with the days left and those pending", async () => {
    buckets.mockReturnValue([
      { type: "VACATION", allocated: 25, used: 10, pending: 2 },
      { type: "HOME_OFFICE", allocated: 0, used: 0, pending: 0 },
    ]);

    await renderCard(2027);

    expect(buckets).toHaveBeenCalledWith(2027);
    expect(screen.getByText(en.dashboard.balance.title(2027))).toBeTruthy();
    expect(screen.getByTestId("balance-VACATION")).toHaveTextContent(
      "Vacation15 / 25 left · 2 pending"
    );
    expect(screen.queryByTestId("balance-HOME_OFFICE")).toBeNull();
  });

  it("renders an overdraft as a negative number of days left", async () => {
    buckets.mockReturnValue([{ type: "VACATION", allocated: 4, used: 5.5, pending: 0 }]);

    await renderCard();

    expect(screen.getByTestId("balance-VACATION")).toHaveTextContent("Vacation-1.5 / 4 left");
  });

  it("renders no quota for a year with nothing allocated", async () => {
    buckets.mockReturnValue([{ type: "VACATION", allocated: 0, used: 0, pending: 0 }]);

    await renderCard();

    expect(screen.getByText(en.dashboard.balance.noQuota(2026))).toBeTruthy();
  });
});
