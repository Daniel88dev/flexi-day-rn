import { nativeApplicationVersion, nativeBuildVersion } from "expo-application";
import {
  ArrowUpRightIcon,
  EnvelopeSimpleIcon,
  FileTextIcon,
  InfoIcon,
  ShieldCheckIcon,
  TranslateIcon,
} from "phosphor-react-native";
import { Linking, Pressable, ScrollView, Switch, View } from "react-native";

import { StackScreen } from "@/components/shell/stack-screen";
import { DashboardDefaultSection } from "@/components/settings/dashboard-default-section";
import { Divider, Row, Section } from "@/components/settings/grouped-list";
import { Icon, useTone } from "@/components/ui/icon";
import { Notice } from "@/components/ui/notice";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { appVersionLabel } from "@/lib/app-version";
import { useRequestScopeGroups } from "@/lib/local-store";
import { useMySettings, useSaveMySettings } from "@/lib/query";
import { initials } from "@/lib/viewer/viewer";
import { useViewer, type Viewer } from "@/lib/viewer/use-viewer";
import { openWebPage, WEB_PATHS } from "@/lib/web";

function AccountHeader({ viewer }: { viewer: Viewer }) {
  return (
    <View
      testID="settings-account"
      className="flex-row items-center gap-3.5 rounded-[24px] bg-card px-4 py-4"
    >
      <View className="h-14 w-14 items-center justify-center rounded-full bg-accent">
        <Text className="font-display text-[18px] font-bold text-primary">
          {initials(viewer.name)}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="font-display text-[18px] font-semibold text-foreground" numberOfLines={1}>
          {viewer.name}
        </Text>
        <Text className="text-[13.5px] text-faint" numberOfLines={1}>
          {viewer.email}
        </Text>
      </View>
    </View>
  );
}

const external = <Icon icon={ArrowUpRightIcon} tone="faint" size={16} />;

export function SettingsScreen() {
  const { t } = useTranslation();
  const viewer = useViewer();
  const primary = useTone("primary");
  const loaded = useMySettings();
  const { settings, save } = useSaveMySettings();
  const groups = useRequestScopeGroups();

  return (
    <StackScreen title={t.nav.settings}>
      <ScrollView
        testID="settings"
        className="flex-1"
        contentContainerStyle={{ gap: 28, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 }}
      >
        {viewer ? <AccountHeader viewer={viewer} /> : null}

        {loaded.isError && !settings ? (
          <View className="gap-2">
            <Notice tone="error" message={t.sync.unreachable} />
            <Pressable
              testID="settings-retry"
              accessibilityRole="button"
              onPress={() => void loaded.refetch()}
              className="self-start rounded-full px-4 py-2 active:opacity-70"
            >
              <Text className="text-[14px] font-semibold text-primary">{t.request.retry}</Text>
            </Pressable>
          </View>
        ) : null}

        <Section
          label={t.settings.notifications}
          footer={t.settings.emailNotificationsHint}
          testID="settings-notifications"
        >
          <Row
            icon={EnvelopeSimpleIcon}
            label={t.settings.emailNotifications}
            accessory={
              <Switch
                testID="settings-email-switch"
                accessibilityLabel={t.settings.emailNotifications}
                value={settings?.emailNotifications ?? true}
                disabled={!settings}
                onValueChange={(emailNotifications) => save({ emailNotifications })}
                trackColor={{ true: primary }}
              />
            }
          />
        </Section>

        {/* Clock reminders (T-63) sits here. */}

        <DashboardDefaultSection settings={settings} groups={groups} onChange={save} />

        {/* Security: Change password (T-57) and Two-factor (T-58) sit here. */}

        <Section
          label={t.settings.language}
          footer={t.settings.languageHint}
          testID="settings-language-section"
        >
          <Row
            testID="settings-language"
            icon={TranslateIcon}
            label={t.settings.language}
            value={t.settings.languageName}
            accessibilityRole="link"
            onPress={() => void Linking.openSettings()}
            accessory={external}
          />
        </Section>

        <Section label={t.settings.about} testID="settings-about">
          <Row
            testID="settings-version"
            icon={InfoIcon}
            label={t.settings.version}
            value={appVersionLabel(nativeApplicationVersion, nativeBuildVersion)}
          />
          <Divider />
          <Row
            testID="settings-privacy"
            icon={ShieldCheckIcon}
            label={t.settings.privacy}
            accessibilityRole="link"
            onPress={() => void openWebPage(WEB_PATHS.privacy)}
            accessory={external}
          />
          <Divider />
          <Row
            testID="settings-terms"
            icon={FileTextIcon}
            label={t.settings.terms}
            accessibilityRole="link"
            onPress={() => void openWebPage(WEB_PATHS.terms)}
            accessory={external}
          />
        </Section>

        {/* Delete account (T-37) comes last, in a section of its own. */}
      </ScrollView>
    </StackScreen>
  );
}
