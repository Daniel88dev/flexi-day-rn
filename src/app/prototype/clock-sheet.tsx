// PROTOTYPE (T-35): the tab bar's clock disc and its formSheet, on fixtures and a fake state machine.
// Open with flexiday://prototype/clock-sheet?scenario=in&variant=A&disc=label&open=1
// Params: scenario (see SCENARIOS in model.ts), variant A|B|C, disc label|inside|capsule,
// loc line|quiet, errors inline|toast, open=1 presents the sheet. No backend, no sign-in.
import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ScrollView, View } from "react-native";

import { Text } from "@/components/ui/text";
import { loadScenario, reread, setPrefs, type Prefs } from "@/prototype/clock-sheet/model";
import { Switcher, TabBar } from "@/prototype/clock-sheet/ui";

type Params = {
  scenario?: string;
  variant?: string;
  disc?: string;
  loc?: string;
  errors?: string;
  open?: string;
  latency?: string;
};

export default function ClockSheetPrototype() {
  const p = useLocalSearchParams<Params>();

  useEffect(() => {
    const prefs: Partial<Prefs> = {};
    if (p.variant) prefs.variant = p.variant as Prefs["variant"];
    if (p.disc) prefs.disc = p.disc as Prefs["disc"];
    if (p.loc) prefs.locLine = p.loc as Prefs["locLine"];
    if (p.errors) prefs.errors = p.errors as Prefs["errors"];
    if (p.latency) prefs.latency = Number(p.latency);
    setPrefs(prefs);
    loadScenario(p.scenario ?? "in");
    if (p.open === "1") setTimeout(() => router.push("/prototype/clock-sheet-open"), 350);
  }, [p.scenario, p.variant, p.disc, p.loc, p.errors, p.open, p.latency]);

  const openSheet = () => router.push("/prototype/clock-sheet-open");

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 120, paddingHorizontal: 16, gap: 16 }}
      >
        <Text
          className="font-display text-[28px] font-semibold text-foreground"
          style={{ letterSpacing: -0.56 }}
        >
          Good afternoon, Daniel
        </Text>
        <Text className="-mt-3 text-[15px] text-muted-foreground">
          Here is who is in and who is out.
        </Text>
        <View className="h-24 rounded-[24px] border border-border bg-card" />
        <View className="h-72 rounded-[24px] border border-border bg-card" />
        <View className="h-40 rounded-[24px] border border-border bg-card" />
      </ScrollView>
      <TabBar
        onClock={() => {
          reread("sheet open");
          openSheet();
        }}
      />
      <Switcher onOpen={openSheet} />
    </View>
  );
}
