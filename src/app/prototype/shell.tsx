// PROTOTYPE. Three variants of the signed-in shell, switched by ?variant=, see issue 24.
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";

import { ShellA } from "@/prototype/shell/a";
import { ShellB } from "@/prototype/shell/b";
import { ShellC } from "@/prototype/shell/c";
import type { Role } from "@/prototype/shell/nav";
import type { ShellProps, ShellState, Viewer } from "@/prototype/shell/props";
import { Switcher, type Variant } from "@/prototype/switcher";

const VARIANTS: Variant[] = [
  { key: "a", name: "Tabs" },
  { key: "b", name: "Drawer" },
  { key: "c", name: "Stack" },
];
const ROLES: Role[] = ["member", "admin"];
const STATES: ShellState[] = ["data", "empty"];

const VIEWER: Viewer = {
  name: "Dana Kučerová",
  email: "dana@northwind.co",
  org: "Northwind",
  teamSize: 12,
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export default function ShellRoute() {
  const params = useLocalSearchParams<{ variant?: string; role?: string; state?: string }>();
  const variant = VARIANTS.some((v) => v.key === params.variant) ? params.variant! : "a";
  const role = ROLES.includes(params.role as Role) ? (params.role as Role) : "member";
  const state = STATES.includes(params.state as ShellState) ? (params.state as ShellState) : "data";
  const [syncedMinutesAgo, setSynced] = useState(4);

  const props: ShellProps = {
    viewer: VIEWER,
    role,
    state,
    syncedMinutesAgo,
    onRefresh: async () => {
      await wait(1100);
      setSynced(0);
    },
    onSignOut: () =>
      Alert.alert("Sign out", "Stub. The jar, the cache and the local store would be wiped.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: () =>
            router.replace({ pathname: "/prototype/welcome", params: { notice: "1" } }),
        },
      ]),
  };

  const Screen = variant === "b" ? ShellB : variant === "c" ? ShellC : ShellA;
  return (
    <>
      <Screen {...props} />
      <Switcher
        variants={VARIANTS}
        current={variant}
        chips={[
          {
            label: `role ${role}`,
            onPress: () =>
              router.setParams({ role: ROLES[(ROLES.indexOf(role) + 1) % ROLES.length] }),
          },
          {
            label: `data ${state}`,
            onPress: () =>
              router.setParams({ state: STATES[(STATES.indexOf(state) + 1) % STATES.length] }),
          },
        ]}
      />
    </>
  );
}
