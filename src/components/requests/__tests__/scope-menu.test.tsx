import { fireEvent, render, screen } from "@testing-library/react-native";
import { ActionSheetIOS } from "react-native";

import { ScopeMenu } from "@/components/requests/scope-menu";
import { en } from "@/i18n/en";
import { TranslationProvider } from "@/i18n/use-translation";

const GROUPS = [
  { groupId: "g-1", groupName: "Design" },
  { groupId: "g-2", groupName: "Support" },
];

let choose: (index: number) => void = () => {};
const showSheet = jest
  .spyOn(ActionSheetIOS, "showActionSheetWithOptions")
  .mockImplementation((_options, callback) => {
    choose = callback;
  });

beforeEach(() => {
  showSheet.mockClear();
});

async function renderMenu(
  groups = GROUPS,
  selected: (typeof GROUPS)[number] | null = GROUPS[0],
  onChange = jest.fn()
) {
  await render(
    <TranslationProvider>
      <ScopeMenu groups={groups} selected={selected} onChange={onChange} />
    </TranslationProvider>
  );
  return onChange;
}

describe("ScopeMenu", () => {
  it("renders nothing when no group is seen in full", async () => {
    await renderMenu([]);

    expect(screen.queryByTestId("requests-scope")).toBeNull();
  });

  it("renders the group in scope", async () => {
    await renderMenu();

    expect(screen.getByTestId("requests-scope")).toHaveTextContent("Design");
  });

  it("renders Only my requests for the viewer's own scope", async () => {
    await renderMenu(GROUPS, null);

    expect(screen.getByTestId("requests-scope")).toHaveTextContent(en.requests.scopeMine);
  });

  it("offers the groups, then Mine, then Cancel", async () => {
    await renderMenu();

    await fireEvent.press(screen.getByTestId("requests-scope"));

    expect(showSheet.mock.calls[0][0]).toMatchObject({
      options: ["Design", "Support", en.requests.scopeMine, en.account.cancel],
      cancelButtonIndex: 3,
    });
  });

  it("picks a group, Mine, or nothing for Cancel", async () => {
    const onChange = await renderMenu();
    await fireEvent.press(screen.getByTestId("requests-scope"));

    choose(1);
    choose(2);
    choose(3);

    expect(onChange.mock.calls).toEqual([[{ kind: "group", groupId: "g-2" }], [{ kind: "mine" }]]);
  });
});
