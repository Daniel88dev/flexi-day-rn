import { LockSimpleIcon } from "phosphor-react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { Dictionary } from "@/i18n";
import { useTranslation } from "@/i18n/use-translation";
import {
  addressLines,
  directoryDate,
  sectionRetention,
  type ContactValues,
  type DirectoryProfile,
  type PersonalValues,
  type SensitiveSectionKey,
} from "@/lib/directory";

import { Facts, Section, type Fact } from "./profile-parts";
import type { ShownSectionState } from "@/lib/directory/shown-sections";
import { showValueSheet } from "./value-sheet";

function Gate<K extends SensitiveSectionKey>({
  section,
  profile,
  state,
  children,
}: {
  section: K;
  profile: DirectoryProfile;
  state: ShownSectionState<K>;
  children: (values: NonNullable<ShownSectionState<K>["values"]>) => ReactNode;
}) {
  const { t } = useTranslation();
  const copy = t.directory.profile;

  if (state.values) {
    return (
      <View className="gap-1.5">
        {children(state.values)}
        {profile.self ? null : (
          <View className="flex-row items-center gap-1.5 px-1">
            <Icon icon={LockSimpleIcon} tone="faint" size={13} />
            <Text className="flex-1 text-[12px] text-faint">{copy.recorded}</Text>
          </View>
        )}
      </View>
    );
  }

  if (state.failure && !state.failure.retryable) {
    return (
      <View
        testID={`directory-profile-refused-${section}`}
        className="flex-row items-center gap-3 rounded-[16px] bg-card px-4 py-3"
      >
        <Text className="flex-1 text-[14.5px] text-muted-foreground">{copy.showRefused}</Text>
      </View>
    );
  }

  if (state.failure) {
    return (
      <View className="flex-row items-center gap-3 rounded-[16px] bg-card px-4 py-3">
        <Text className="flex-1 text-[14.5px] text-danger">{copy.showFailed}</Text>
        <Pressable
          testID={`directory-profile-retry-${section}`}
          onPress={state.show}
          accessibilityRole="button"
          accessibilityLabel={t.directory.retry}
          hitSlop={6}
          className="rounded-full bg-accent px-4 py-2 active:opacity-70"
        >
          <Text className="text-[14px] font-semibold text-primary">{t.directory.retry}</Text>
        </Pressable>
      </View>
    );
  }

  if (profile.self) {
    return (
      <View className="items-center rounded-[16px] bg-card px-4 py-4">
        <ActivityIndicator accessibilityLabel={copy.showing} />
      </View>
    );
  }

  return (
    <View className="flex-row items-center gap-3 rounded-[16px] bg-card px-4 py-3">
      <Icon icon={LockSimpleIcon} tone="faint" size={18} />
      <Text className="flex-1 text-[14.5px] text-muted-foreground">{copy.hidden}</Text>
      <Pressable
        testID={`directory-profile-show-${section}`}
        disabled={state.pending}
        onPress={state.show}
        accessibilityRole="button"
        accessibilityLabel={state.pending ? copy.showing : copy.show}
        accessibilityState={{ disabled: state.pending, busy: state.pending }}
        hitSlop={6}
        style={state.pending ? { opacity: 0.6 } : undefined}
        className="rounded-full bg-accent px-4 py-2 active:opacity-70"
      >
        <Text className="text-[14px] font-semibold text-primary">
          {state.pending ? copy.showing : copy.show}
        </Text>
      </Pressable>
    </View>
  );
}

// Copy is never offered here: a private or emergency number must not reach the clipboard.
function contactFacts(values: ContactValues, t: Dictionary): Fact[] {
  const copy = t.directory.profile;
  const { privatePhone, privateEmail } = values;
  const slots = [values.emergencyContact1, values.emergencyContact2];
  return [
    {
      label: copy.privatePhone,
      value: privatePhone?.display ?? null,
      testID: "directory-profile-value-privatePhone",
      onPress: privatePhone
        ? () => showValueSheet({ kind: "phone", phone: privatePhone, copyable: false }, t)
        : undefined,
    },
    {
      label: copy.privateEmail,
      value: privateEmail,
      testID: "directory-profile-value-privateEmail",
      onPress: privateEmail
        ? () => showValueSheet({ kind: "email", email: privateEmail, copyable: false }, t)
        : undefined,
    },
    ...slots.map((slot, index): Fact => ({
      label: copy.emergencyContact(index + 1),
      value: slot ? `${slot.name}, ${slot.phone.display}` : null,
      testID: `directory-profile-value-emergencyContact${index + 1}`,
      onPress: slot
        ? () => showValueSheet({ kind: "phone", phone: slot.phone, copyable: false }, t)
        : undefined,
    })),
  ];
}

function personalFacts(values: PersonalValues, t: Dictionary): Fact[] {
  const copy = t.directory.profile;
  return [
    {
      label: copy.homeAddress,
      value: values.homeAddress ? addressLines(values.homeAddress).join("\n") : null,
    },
    {
      label: copy.dateOfBirth,
      value: values.dateOfBirth ? directoryDate(t.common.locale, values.dateOfBirth) : null,
    },
  ];
}

/**
 * Contact and Personal, closed behind Show for anyone but the person. Their values come from the
 * screen's `useShownSections`, never from the profile read.
 */
export function SensitiveSections({
  profile,
  stateOf,
}: {
  profile: DirectoryProfile;
  stateOf: <K extends SensitiveSectionKey>(section: K) => ShownSectionState<K>;
}) {
  const { t } = useTranslation();
  const { contact, personal } = profile.sections;
  return (
    <>
      {contact ? (
        <Section
          testID="directory-profile-section-contact"
          title={t.directory.sections.contact}
          {...sectionRetention(profile, "contact")}
        >
          <Gate section="contact" profile={profile} state={stateOf("contact")}>
            {(values) => <Facts t={t} facts={contactFacts(values, t)} />}
          </Gate>
        </Section>
      ) : null}
      {personal ? (
        <Section
          testID="directory-profile-section-personal"
          title={t.directory.sections.personal}
          {...sectionRetention(profile, "personal")}
        >
          <Gate section="personal" profile={profile} state={stateOf("personal")}>
            {(values) => <Facts t={t} facts={personalFacts(values, t)} />}
          </Gate>
        </Section>
      ) : null}
    </>
  );
}
