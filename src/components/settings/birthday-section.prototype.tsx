// PROTOTYPE (T-339): three looks for the birthday settings on the phone. The pill at the bottom
// cycles the variant, which Pro groups exist and whether a birthday is set. Fixtures only,
// nothing saves. Lives on prototype/birthday-settings only.

import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams } from "expo-router";
import {
  CakeIcon,
  CheckIcon,
  LockIcon,
  MinusIcon,
  TrashIcon,
  UsersIcon,
  CalendarDotsIcon,
} from "phosphor-react-native";
import { useState } from "react";
import { Modal, Pressable, ScrollView, TextInput, View } from "react-native";

import { Divider, Row, Section } from "@/components/settings/grouped-list";
import { Icon, useTone } from "@/components/ui/icon";
import { Switch } from "@/components/ui/switch";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const TODAY = new Date(2026, 9, 17);
const CORAL = "rgb(222, 112, 78)";

type Birthday = { day: number; month: number; year: number | null } | null;
type ProMode = "some" | "all" | "none";
type Group = { name: string; pro: boolean };

const VARIANTS = [
  { key: "A", name: "Native rows" },
  { key: "B", name: "Typed fields" },
  { key: "C", name: "Summary + sheet" },
];

function groupsFor(pro: ProMode): Group[] {
  const base = [
    { name: "Platform", pro: true },
    { name: "Support Prague", pro: true },
    { name: "Climbing club", pro: false },
  ];
  if (pro === "all") return base.map((g) => ({ ...g, pro: true }));
  if (pro === "none") return base.map((g) => ({ ...g, pro: false }));
  return base;
}

function ageOf(b: Birthday) {
  if (!b || b.year === null) return null;
  const had =
    TODAY.getMonth() + 1 > b.month ||
    (TODAY.getMonth() + 1 === b.month && TODAY.getDate() >= b.day);
  return TODAY.getFullYear() - b.year - (had ? 0 : 1);
}

function label(b: Birthday, withYear = true) {
  if (!b) return null;
  const base = `${b.day} ${MONTHS[b.month - 1]}`;
  return withYear && b.year !== null ? `${base} ${b.year}` : base;
}

function joinNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function proNote(groups: Group[]) {
  const pro = groups.filter((g) => g.pro).map((g) => g.name);
  const free = groups.filter((g) => !g.pro).map((g) => g.name);
  return `Shown in ${joinNames(pro)}.${
    free.length > 0 ? ` ${joinNames(free)} is on the Free plan, so it doesn't show there.` : ""
  }`;
}

const SHARE_COPY =
  "Members see it on the group calendar, and on team calendar feeds without your age. It never goes into anyone's Google or Microsoft calendar.";

// Starting state when no deep-link params are given; edit to stage a screenshot.
const START = { variant: "A", pro: "some" as ProMode, share: false };

export function useBirthdayPrototype() {
  const params = useLocalSearchParams<{
    variant?: string;
    pro?: string;
    bday?: string;
    share?: string;
  }>();
  const [variant, setVariant] = useState(params.variant ?? START.variant);
  const [pro, setPro] = useState<ProMode>((params.pro as ProMode) ?? START.pro);
  const [birthday, setBirthday] = useState<Birthday>(
    params.bday === "empty" ? null : { day: 14, month: 3, year: 1988 }
  );
  const [sharing, setSharing] = useState(params.share ? params.share === "1" : START.share);
  return { variant, setVariant, pro, setPro, birthday, setBirthday, sharing, setSharing };
}

type Proto = ReturnType<typeof useBirthdayPrototype>;

function NoProNotice() {
  return (
    <View className="flex-row gap-3 rounded-[24px] bg-card px-4 py-3.5">
      <Icon icon={LockIcon} tone="faint" size={18} />
      <Text className="flex-1 text-[13.5px] leading-[19px] text-muted-foreground">
        None of your groups is on Pro, so there is nowhere to share your birthday yet. You still see
        it on your own calendar.
      </Text>
    </View>
  );
}

function ShareSwitch({ p, testID }: { p: Proto; testID: string }) {
  const primary = useTone("primary");
  return (
    <Switch
      testID={testID}
      accessibilityLabel="Share my birthday with my groups"
      value={p.sharing}
      disabled={!p.birthday}
      onValueChange={p.setSharing}
      trackColor={{ true: primary }}
    />
  );
}

/* A: iOS rows, the system date wheel inline, a switch for the year. */
function VariantA({ p }: { p: Proto }) {
  const [open, setOpen] = useState(false);
  const primary = useTone("primary");
  const groups = groupsFor(p.pro);
  const anyPro = groups.some((g) => g.pro);
  const age = ageOf(p.birthday);
  const b = p.birthday;
  const pickerValue = new Date(b?.year ?? 2000, (b?.month ?? 1) - 1, b?.day ?? 1);

  return (
    <View className="gap-7">
      <Section
        label="Birthday"
        footer={
          b === null
            ? "Optional. Your groups see it only if you share it."
            : age !== null
              ? `With the year, anyone who sees your birthday also sees your age (${age}). Turn the year off and the age goes with it.`
              : "No year, so no one sees your age."
        }
      >
        <Row
          testID="proto-bday-date"
          icon={CakeIcon}
          label="Birthday"
          value={b ? label(b, false) : "Add"}
          onPress={() => {
            if (!b) p.setBirthday({ day: 1, month: 1, year: null });
            setOpen((o) => !o);
          }}
        />
        {open && b ? (
          <View className="items-center pb-2">
            <DateTimePicker
              mode="date"
              display="spinner"
              value={pickerValue}
              maximumDate={TODAY}
              onValueChange={(_e, d) =>
                p.setBirthday({
                  day: d.getDate(),
                  month: d.getMonth() + 1,
                  year: b.year === null ? null : d.getFullYear(),
                })
              }
            />
          </View>
        ) : null}
        {b ? (
          <>
            <Divider />
            <Row
              icon={CalendarDotsIcon}
              label="Include the year"
              value={b.year !== null ? String(b.year) : null}
              accessory={
                <Switch
                  trackColor={{ true: primary }}
                  value={b.year !== null}
                  onValueChange={(on) =>
                    p.setBirthday({ ...b, year: on ? pickerValue.getFullYear() : null })
                  }
                />
              }
            />
          </>
        ) : null}
      </Section>

      {anyPro ? (
        <Section footer={p.sharing && b ? `${SHARE_COPY}\n\n${proNote(groups)}` : SHARE_COPY}>
          <Row
            icon={UsersIcon}
            label="Share with my groups"
            accessory={<ShareSwitch p={p} testID="proto-bday-share-a" />}
          />
        </Section>
      ) : (
        <NoProNotice />
      )}

      {b ? (
        <Section>
          <Row
            icon={TrashIcon}
            label="Remove birthday"
            destructive
            onPress={() => {
              p.setBirthday(null);
              p.setSharing(false);
              setOpen(false);
            }}
          />
        </Section>
      ) : null}
    </View>
  );
}

function NumberBox({
  label: boxLabel,
  value,
  placeholder,
  width,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  width: number;
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ width }}>
      <Text className="mb-1.5 text-[12.5px] font-semibold text-muted-foreground">{boxLabel}</Text>
      <TextInput
        value={value}
        placeholder={placeholder}
        keyboardType="number-pad"
        maxLength={boxLabel.startsWith("Year") ? 4 : 2}
        onChangeText={(t) => onChange(t.replace(/\D/g, ""))}
        className="h-[50px] rounded-[12px] border border-input bg-background px-3 text-center text-[18px] font-semibold text-foreground"
      />
    </View>
  );
}

function Chip({ text, off }: { text: string; off?: boolean }) {
  return (
    <View
      className="flex-row items-center gap-1.5 self-start rounded-[8px] px-2 py-1"
      style={{ backgroundColor: off ? "transparent" : "rgba(222,112,78,0.16)" }}
    >
      <CakeIcon size={13} color={off ? "#888" : CORAL} />
      <Text
        className={cn("text-[13px] font-semibold", off ? "text-faint line-through" : "")}
        style={off ? undefined : { color: CORAL }}
      >
        {text}
      </Text>
    </View>
  );
}

/* B: three number boxes on one card, a live "what others see" list under it. */
function VariantB({ p }: { p: Proto }) {
  const b = p.birthday;
  const [day, setDay] = useState(b ? String(b.day) : "");
  const [month, setMonth] = useState(b ? String(b.month) : "");
  const [year, setYear] = useState(b?.year ? String(b.year) : "");
  const groups = groupsFor(p.pro);
  const anyPro = groups.some((g) => g.pro);
  const proNames = groups.filter((g) => g.pro).map((g) => g.name);

  const sync = (d: string, m: string, y: string) => {
    const dn = Number(d);
    const mn = Number(m);
    const yn = /^\d{4}$/.test(y) ? Number(y) : null;
    p.setBirthday(
      dn >= 1 && dn <= 31 && mn >= 1 && mn <= 12 ? { day: dn, month: mn, year: yn } : null
    );
  };
  const age = ageOf(p.birthday);
  const shown = p.sharing && anyPro && p.birthday !== null;
  const first = "Olivia";

  return (
    <View className="gap-7">
      <Section label="Birthday">
        <View className="gap-3 px-4 py-4">
          <View className="flex-row gap-3">
            <NumberBox
              label="Day"
              value={day}
              placeholder="DD"
              width={64}
              onChange={(v) => {
                setDay(v);
                sync(v, month, year);
              }}
            />
            <NumberBox
              label="Month"
              value={month}
              placeholder="MM"
              width={64}
              onChange={(v) => {
                setMonth(v);
                sync(day, v, year);
              }}
            />
            <View className="flex-1">
              <NumberBox
                label="Year (optional)"
                value={year}
                placeholder="YYYY"
                width={120}
                onChange={(v) => {
                  setYear(v);
                  sync(day, month, v);
                }}
              />
            </View>
          </View>
          <Text className="text-[12.5px] leading-[18px] text-faint">
            {p.birthday
              ? `${label(p.birthday, false)}. The year shows your age to everyone who sees the birthday.`
              : "Leave the year empty to keep your age private."}
          </Text>
        </View>
        {anyPro ? (
          <>
            <Divider />
            <Row
              icon={UsersIcon}
              label="Share with my groups"
              accessory={<ShareSwitch p={p} testID="proto-bday-share-b" />}
            />
          </>
        ) : null}
      </Section>

      {anyPro ? null : <NoProNotice />}

      <Section label="What others see">
        <View className="gap-3.5 px-4 py-4">
          <View className="gap-1.5">
            <Text className="text-[14px] font-semibold text-foreground">Your calendar</Text>
            {p.birthday ? (
              <Chip text={age !== null ? `You turn ${age + 1}` : "Your birthday"} />
            ) : (
              <Text className="text-[13px] text-faint">Nothing yet</Text>
            )}
          </View>
          <View className="gap-1.5">
            <Text className="text-[14px] font-semibold text-foreground">
              {proNames.length > 0 ? joinNames(proNames) : "Your groups"}
            </Text>
            <Chip
              off={!shown}
              text={age !== null && shown ? `${first} turns ${age + 1}` : `${first}'s birthday`}
            />
          </View>
          <View className="gap-1.5">
            <Text className="text-[14px] font-semibold text-foreground">Team calendar feeds</Text>
            <Chip off={!shown} text={`${first}'s birthday`} />
            <Text className="text-[12px] text-faint">Never with your age.</Text>
          </View>
          <View className="gap-1">
            <Text className="text-[14px] font-semibold text-foreground">
              Colleagues&apos; Google or Microsoft calendars
            </Text>
            <Text className="text-[13px] text-faint">Never</Text>
          </View>
        </View>
      </Section>
    </View>
  );
}

function Mark({ on }: { on: boolean }) {
  return (
    <View className="w-12 items-center">
      <Icon icon={on ? CheckIcon : MinusIcon} tone={on ? "primary" : "faint"} size={16} />
    </View>
  );
}

/* C: one summary card, edited in a page sheet, and a who-sees-what table. */
function VariantC({ p }: { p: Proto }) {
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState<Birthday>(p.birthday);
  const [withYear, setWithYear] = useState(p.birthday?.year != null);
  const groups = groupsFor(p.pro);
  const anyPro = groups.some((g) => g.pro);
  const b = p.birthday;
  const age = ageOf(b);
  const shown = p.sharing && anyPro && b !== null;
  const hasYear = b?.year != null;
  const proNames = groups.filter((g) => g.pro).map((g) => g.name);
  const primary = useTone("primary");
  const d = draft ?? { day: 1, month: 1, year: 2000 };

  const rows = [
    { who: "You", date: b !== null, age: hasYear },
    {
      who: proNames.length > 0 ? joinNames(proNames) : "Your groups",
      date: shown,
      age: shown && hasYear,
    },
    { who: "Team calendar feeds", date: shown, age: false },
    { who: "Google or Microsoft calendars", date: false, age: false },
  ];

  return (
    <View className="gap-7">
      <Pressable
        testID="proto-bday-summary"
        onPress={() => {
          setDraft(b ?? { day: 1, month: 1, year: null });
          setWithYear(b ? b.year !== null : false);
          setSheet(true);
        }}
        className="flex-row items-center gap-3.5 rounded-[24px] bg-card px-4 py-4 active:opacity-70"
      >
        <View
          className="h-12 w-12 items-center justify-center rounded-[14px]"
          style={{ backgroundColor: "rgba(222,112,78,0.16)" }}
        >
          <CakeIcon size={24} color={CORAL} />
        </View>
        <View className="flex-1">
          <Text className="text-[11px] font-bold tracking-[1px] text-faint uppercase">
            Birthday
          </Text>
          <Text className="font-display text-[19px] font-semibold text-foreground">
            {b ? label(b, false) : "Add your birthday"}
          </Text>
          {b ? (
            <Text className="text-[13px] text-faint">
              {age !== null ? `${b.year}, age ${age}` : "No year, age hidden"}
            </Text>
          ) : null}
        </View>
        <Text className="text-[15px] font-semibold text-primary">{b ? "Edit" : "Add"}</Text>
      </Pressable>

      {anyPro ? (
        <Section label="Who sees it" footer={shown ? proNote(groups) : undefined}>
          <Row
            icon={UsersIcon}
            label="Share with my groups"
            accessory={<ShareSwitch p={p} testID="proto-bday-share-c" />}
          />
          <Divider />
          <View className="px-4 pt-2 pb-3">
            <View className="flex-row pb-1">
              <Text className="flex-1 text-[11.5px] font-semibold text-faint">Who</Text>
              <Text className="w-12 text-center text-[11.5px] font-semibold text-faint">Date</Text>
              <Text className="w-12 text-center text-[11.5px] font-semibold text-faint">Age</Text>
            </View>
            {rows.map((r) => (
              <View key={r.who} className="flex-row items-center border-t border-border py-2.5">
                <Text className="flex-1 pr-2 text-[14px] text-foreground">{r.who}</Text>
                <Mark on={r.date} />
                <Mark on={r.age} />
              </View>
            ))}
          </View>
        </Section>
      ) : (
        <NoProNotice />
      )}

      <Modal
        visible={sheet}
        presentationStyle="pageSheet"
        animationType="slide"
        onRequestClose={() => setSheet(false)}
      >
        <View className="flex-1 bg-background">
          <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
            <Pressable onPress={() => setSheet(false)} className="active:opacity-70">
              <Text className="text-[16px] text-primary">Cancel</Text>
            </Pressable>
            <Text className="text-[16px] font-semibold text-foreground">Birthday</Text>
            <Pressable
              onPress={() => {
                p.setBirthday(
                  draft ? { ...draft, year: withYear ? (draft.year ?? 2000) : null } : null
                );
                setSheet(false);
              }}
              className="active:opacity-70"
            >
              <Text className="text-[16px] font-semibold text-primary">Save</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ gap: 24, padding: 16 }}>
            <View className="items-center rounded-[24px] bg-card py-2">
              <DateTimePicker
                mode="date"
                display="spinner"
                value={new Date(d.year ?? 2000, d.month - 1, d.day)}
                maximumDate={TODAY}
                onValueChange={(_e, dt) =>
                  setDraft({ day: dt.getDate(), month: dt.getMonth() + 1, year: dt.getFullYear() })
                }
              />
            </View>
            <Section footer="With the year, anyone who sees your birthday also sees your age. Turn it off and the age goes with it.">
              <Row
                icon={CalendarDotsIcon}
                label="Include the year"
                accessory={
                  <Switch
                    value={withYear}
                    onValueChange={setWithYear}
                    trackColor={{ true: primary }}
                  />
                }
              />
            </Section>
            {b ? (
              <Section>
                <Row
                  icon={TrashIcon}
                  label="Remove birthday"
                  destructive
                  onPress={() => {
                    p.setBirthday(null);
                    p.setSharing(false);
                    setSheet(false);
                  }}
                />
              </Section>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

export function BirthdaySectionPrototype({ p }: { p: Proto }) {
  return (
    <View testID="proto-birthday">
      {p.variant === "A" && <VariantA p={p} />}
      {p.variant === "B" && <VariantB key={`b${p.pro}`} p={p} />}
      {p.variant === "C" && <VariantC p={p} />}
      <Text className="mt-3 px-4 font-mono text-[10.5px] text-faint">
        prototype state: {label(p.birthday) ?? "no birthday"}, age {ageOf(p.birthday) ?? "hidden"},
        sharing {String(p.sharing)}, pro {p.pro}
      </Text>
    </View>
  );
}

export function BirthdayPrototypePill({ p }: { p: Proto }) {
  const i = Math.max(
    0,
    VARIANTS.findIndex((v) => v.key === p.variant)
  );
  const go = (delta: number) =>
    p.setVariant(VARIANTS[(i + delta + VARIANTS.length) % VARIANTS.length].key);
  const nextPro: Record<ProMode, ProMode> = { some: "all", all: "none", none: "some" };
  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 0, right: 0, bottom: 28, alignItems: "center" }}
    >
      <View
        className="flex-row items-center gap-1 rounded-full px-2 py-1.5"
        style={{ backgroundColor: "#111", borderWidth: 2, borderColor: "#fde047" }}
      >
        <Pressable testID="proto-prev" onPress={() => go(-1)} className="px-2.5 py-1">
          <Text className="text-[15px] font-bold text-white">‹</Text>
        </Pressable>
        <Text className="text-[13px] font-semibold text-white">
          {VARIANTS[i].key} · {VARIANTS[i].name}
        </Text>
        <Pressable testID="proto-next" onPress={() => go(1)} className="px-2.5 py-1">
          <Text className="text-[15px] font-bold text-white">›</Text>
        </Pressable>
        <Pressable
          testID="proto-pro"
          onPress={() => p.setPro(nextPro[p.pro])}
          className="rounded-full px-2.5 py-1"
          style={{ backgroundColor: "rgba(255,255,255,0.14)" }}
        >
          <Text className="text-[12px] font-semibold text-white">pro: {p.pro}</Text>
        </Pressable>
      </View>
    </View>
  );
}
