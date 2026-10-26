import {
  ArrowSquareOutIcon,
  CaretRightIcon,
  ChatCircleIcon,
  EnvelopeIcon,
  PencilSimpleIcon,
  PhoneIcon,
  XIcon,
  type Icon as PhosphorIcon,
} from "phosphor-react-native";
import { useState, type ReactNode } from "react";
import { Image, Linking, Modal, Pressable, RefreshControl, ScrollView, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { Dictionary } from "@/i18n";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import {
  contactButtons,
  directoryDate,
  headerPicture,
  isExternalWorker,
  retentionLines,
  rowMarkers,
  sectionRetention,
  selfNotice,
  type DirectoryLabel,
  type DirectoryOrganization,
  type DirectoryProfile,
  type DirectorySectionKey,
  type SectionRetention,
} from "@/lib/directory";
import {
  ApiError,
  useDirectoryOrganizations,
  useDirectoryProfile,
  useRereadDirectoryOnFocus,
} from "@/lib/query";
import { useViewer } from "@/lib/viewer/use-viewer";
import { openWebPage } from "@/lib/web";

import { DirectoryAvatar, Markers, openProfile } from "./directory-row";
import { DirectoryNote, DirectoryOffline, LapsedBanner } from "./directory-states";
import { showValueSheet } from "./value-sheet";

const refused = (error: unknown) =>
  error instanceof ApiError && error.status >= 400 && error.status < 500;

const entryName = (entry: DirectoryLabel, t: Dictionary) =>
  entry.archived ? t.directory.archived(entry.name) : entry.name;

type Fact = {
  label: string;
  value: string | null;
  /** A tappable value: an action sheet, or the Reports to profile. */
  onPress?: () => void;
  testID?: string;
};

function Facts({ facts, t }: { facts: Fact[]; t: Dictionary }) {
  return (
    <View className="overflow-hidden rounded-[16px] bg-card">
      {facts.map((fact, index) => {
        const value = fact.value ?? t.directory.profile.notSet;
        const body = (
          <View className="flex-1">
            <Text className="text-[12.5px] text-muted-foreground">{fact.label}</Text>
            <Text
              className={cn(
                "text-[15.5px] font-semibold",
                fact.value === null
                  ? "text-faint"
                  : fact.onPress
                    ? "text-primary"
                    : "text-foreground"
              )}
            >
              {value}
            </Text>
          </View>
        );
        const row = cn(
          "flex-row items-center gap-3 px-4 py-2.5",
          index > 0 && "border-t border-border"
        );
        if (!fact.onPress || fact.value === null) {
          return (
            <View key={fact.label} className={row}>
              {body}
            </View>
          );
        }
        return (
          <Pressable
            key={fact.label}
            testID={fact.testID}
            onPress={fact.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${fact.label}, ${value}`}
            className={cn(row, "active:opacity-70")}
          >
            {body}
            <Icon icon={CaretRightIcon} tone="faint" size={16} />
          </Pressable>
        );
      })}
    </View>
  );
}

function Section({
  testID,
  title,
  removesOn,
  removedOn,
  children,
}: {
  testID: string;
  title: string;
  removesOn?: string | null;
  removedOn?: string | null;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const { locale } = t.common;
  const copy = t.directory.profile;
  return (
    <View testID={testID} className="mt-5">
      <View className="flex-row items-baseline justify-between gap-3 px-1 pb-1.5">
        <Text
          accessibilityRole="header"
          className="text-[11px] font-bold tracking-[1px] text-faint uppercase"
        >
          {title}
        </Text>
        {removesOn ? (
          <Text className="text-[12px] font-semibold text-warm">
            {copy.removesOn(directoryDate(locale, removesOn))}
          </Text>
        ) : null}
      </View>
      {removedOn ? (
        <View className="rounded-[16px] bg-card px-4 py-3">
          <Text className="text-[14.5px] text-muted-foreground">
            {copy.removedOn(directoryDate(locale, removedOn))}
          </Text>
        </View>
      ) : (
        children
      )}
    </View>
  );
}

function ContactButton({
  testID,
  label,
  icon,
  url,
}: {
  testID: string;
  label: string;
  icon: PhosphorIcon;
  url: string | null;
}) {
  return (
    <Pressable
      testID={testID}
      disabled={url === null}
      onPress={() => {
        if (url) void Linking.openURL(url).catch((cause: unknown) => console.error(cause));
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: url === null }}
      style={url === null ? { opacity: 0.4 } : undefined}
      className="h-16 flex-1 items-center justify-center gap-1 rounded-[16px] bg-card active:opacity-70"
    >
      <Icon icon={icon} tone="primary" size={20} weight="fill" />
      <Text className="text-[13px] font-semibold text-primary">{label}</Text>
    </Pressable>
  );
}

function ContactRow({ profile }: { profile: DirectoryProfile }) {
  const { t } = useTranslation();
  const copy = t.directory.profile;
  const buttons = contactButtons(profile);
  if (!buttons) return null;
  return (
    <View testID="directory-profile-contact-row" className="mt-4 flex-row gap-2">
      <ContactButton
        testID="directory-profile-call"
        label={copy.call}
        icon={PhoneIcon}
        url={buttons.call}
      />
      <ContactButton
        testID="directory-profile-message"
        label={copy.message}
        icon={ChatCircleIcon}
        url={buttons.message}
      />
      <ContactButton
        testID="directory-profile-email"
        label={copy.email}
        icon={EnvelopeIcon}
        url={buttons.email}
      />
    </View>
  );
}

function SelfNotice({
  profile,
  organization,
}: {
  profile: DirectoryProfile;
  organization: DirectoryOrganization | undefined;
}) {
  const { t } = useTranslation();
  const copy = t.directory.profile;
  const notice = selfNotice(profile, organization);
  // The name comes from the organizations read; the shell has it long before a profile opens.
  if (!notice || !organization) return null;
  const { name } = organization;
  return (
    <View
      testID="directory-profile-self"
      className="mt-4 flex-row gap-3 rounded-[16px] bg-accent px-4 py-3"
    >
      <Icon icon={PencilSimpleIcon} tone="primary" size={18} />
      <View className="flex-1 gap-1.5">
        <Text className="text-[14px] leading-5 text-foreground">
          {notice.lapsed ? copy.selfNoticeLapsed(name) : copy.selfNotice(name)}
        </Text>
        <Pressable
          testID="directory-profile-edit-on-web"
          onPress={() => void openWebPage(notice.editPath)}
          accessibilityRole="link"
          accessibilityLabel={copy.editOnWeb}
          hitSlop={6}
          className="flex-row items-center gap-1 self-start active:opacity-70"
        >
          <Text className="text-[14.5px] font-semibold text-primary">{copy.editOnWeb}</Text>
          <Icon icon={ArrowSquareOutIcon} tone="primary" size={14} />
        </Pressable>
      </View>
    </View>
  );
}

function Header({
  profile,
  viewerUserId,
  onOpenPhoto,
}: {
  profile: DirectoryProfile;
  viewerUserId: string | null;
  onOpenPhoto: () => void;
}) {
  const { t } = useTranslation();
  const picture = headerPicture(profile);
  const card = profile.sections.card;
  const subtitle = [card?.jobTitle ?? profile.jobTitle, card?.department?.name]
    .filter(Boolean)
    .join(" · ");
  const avatar = <DirectoryAvatar person={profile} uri={picture.uri} size={84} />;
  return (
    <View className="pt-2">
      {picture.viewable ? (
        <Pressable
          testID="directory-profile-photo"
          onPress={onOpenPhoto}
          accessibilityRole="imagebutton"
          accessibilityLabel={t.directory.profile.photo}
          className="self-start active:opacity-80"
        >
          {avatar}
        </Pressable>
      ) : (
        avatar
      )}
      <Text
        accessibilityRole="header"
        className="font-display mt-3 text-[28px] font-semibold text-foreground"
      >
        {profile.name}
      </Text>
      {subtitle ? <Text className="text-[15px] text-muted-foreground">{subtitle}</Text> : null}
      <Markers markers={rowMarkers(profile, viewerUserId)} t={t} withTestIDs />
    </View>
  );
}

function PhotoViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Modal visible={uri !== null} animationType="fade" onRequestClose={onClose}>
      <View testID="directory-profile-photo-viewer" className="flex-1 bg-black pt-safe pb-safe">
        <Pressable
          testID="directory-profile-photo-close"
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t.directory.profile.closePhoto}
          hitSlop={8}
          className="m-3 h-10 w-10 items-center justify-center self-end rounded-full active:opacity-70"
        >
          <XIcon color="#fff" size={22} weight="bold" />
        </Pressable>
        {uri ? (
          <Image
            source={{ uri }}
            resizeMode="contain"
            className="flex-1"
            accessibilityLabel={t.directory.profile.photo}
            accessibilityIgnoresInvertColors
          />
        ) : null}
      </View>
    </Modal>
  );
}

function CardSection({ profile }: { profile: DirectoryProfile }) {
  const { t } = useTranslation();
  const copy = t.directory.profile;
  const card = profile.sections.card;
  if (!card) return null;
  const location = card.location
    ? [entryName(card.location, t), card.location.country?.name].filter(Boolean).join(", ")
    : null;
  const reportsTo = card.reportsTo;
  return (
    <Section
      testID="directory-profile-section-card"
      title={t.directory.sections.card}
      {...sectionRetention(profile, "card")}
    >
      <Facts
        t={t}
        facts={[
          { label: copy.jobTitle, value: card.jobTitle },
          {
            label: t.directory.department,
            value: card.department ? entryName(card.department, t) : null,
          },
          { label: t.directory.location, value: location },
          reportsTo?.name
            ? {
                label: copy.reportsTo,
                value: reportsTo.name,
                testID: "directory-profile-reports-to",
                onPress: () => openProfile(profile.organizationId, reportsTo.employmentId),
              }
            : { label: copy.reportsTo, value: reportsTo ? copy.reportsHidden : null },
        ]}
      />
    </Section>
  );
}

function WorkContactSection({ profile }: { profile: DirectoryProfile }) {
  const { t } = useTranslation();
  const copy = t.directory.profile;
  const workContact = profile.sections.workContact;
  if (!workContact) return null;
  const { workEmail, workPhone } = workContact;
  return (
    <Section
      testID="directory-profile-section-workContact"
      title={t.directory.sections.workContact}
      {...sectionRetention(profile, "workContact")}
    >
      {!workEmail && !workPhone ? (
        <View className="rounded-[16px] bg-card px-4 py-3">
          <Text className="text-[14.5px] text-muted-foreground">{copy.noWorkContact}</Text>
        </View>
      ) : (
        <Facts
          t={t}
          facts={[
            {
              label: copy.workEmail,
              value: workEmail,
              testID: "directory-profile-value-workEmail",
              onPress: workEmail
                ? () => showValueSheet({ kind: "email", email: workEmail, copyable: true }, t)
                : undefined,
            },
            {
              label: copy.workPhone,
              value: workPhone?.display ?? null,
              testID: "directory-profile-value-workPhone",
              onPress: workPhone
                ? () => showValueSheet({ kind: "phone", phone: workPhone, copyable: true }, t)
                : undefined,
            },
          ]}
        />
      )}
    </Section>
  );
}

function JobSection({ profile }: { profile: DirectoryProfile }) {
  const { t } = useTranslation();
  const copy = t.directory.profile;
  const job = profile.sections.job;
  if (!job) return null;
  const day = (value: string | null) => (value ? directoryDate(t.common.locale, value) : null);
  const external = isExternalWorker(profile);
  const facts: Fact[] = [];
  if (job.legalName) facts.push({ label: copy.legalName, value: job.legalName });
  facts.push({ label: copy.employeeNumber, value: job.employeeNumber });
  facts.push({ label: copy.startDate, value: day(job.startDate) });
  if (!external) facts.push({ label: copy.probationEndDate, value: day(job.probationEndDate) });
  facts.push({ label: copy.leavingDate, value: day(job.leavingDate) });
  if (!external) {
    facts.push({
      label: copy.contractType,
      value: job.contractType ? copy.contractTypes[job.contractType] : null,
    });
    facts.push({
      label: copy.workingTime,
      value: job.workingTime ? copy.workingTimes[job.workingTime] : null,
    });
  }
  return (
    <Section
      testID="directory-profile-section-job"
      title={t.directory.sections.job}
      {...sectionRetention(profile, "job")}
    >
      <Facts t={t} facts={facts} />
    </Section>
  );
}

const retentionTone = (retention: SectionRetention) =>
  retention.status === "REMOVED_ON"
    ? "text-danger"
    : retention.status === "REMOVES_ON"
      ? "text-warm"
      : "text-foreground";

function retentionText(retention: SectionRetention, t: Dictionary): string {
  const copy = t.directory.profile;
  switch (retention.status) {
    case "REMOVES_ON":
      return copy.removesOn(directoryDate(t.common.locale, retention.date));
    case "REMOVED_ON":
      return copy.removedOn(directoryDate(t.common.locale, retention.date));
    case "KEPT_UNTIL_ERASED":
      return copy.keptUntilErased;
    case "ON_HOLD":
      return copy.onHold;
  }
}

function RetentionBlock({ profile }: { profile: DirectoryProfile }) {
  const { t } = useTranslation();
  const copy = t.directory.profile;
  const retention = profile.retention;
  if (!retention) return null;
  const hold = retention.hold;
  const holdLine = hold
    ? hold.setBy?.name
      ? copy.holdBy(hold.setBy.name, directoryDate(t.common.locale, hold.setAt))
      : copy.holdSince(directoryDate(t.common.locale, hold.setAt))
    : copy.noHold;
  const lines = retentionLines(profile);
  return (
    <View testID="directory-profile-retention" className="mt-5">
      <Text
        accessibilityRole="header"
        className="px-1 pb-1.5 text-[11px] font-bold tracking-[1px] text-faint uppercase"
      >
        {copy.retention}
      </Text>
      <View className="overflow-hidden rounded-[16px] bg-card">
        <View className="px-4 py-2.5">
          <Text className={cn("text-[14.5px]", hold ? "text-warm" : "text-muted-foreground")}>
            {holdLine}
          </Text>
        </View>
        {lines.map(({ section, retention: line }) => (
          <View key={section} className="border-t border-border px-4 py-2.5">
            <Text className="text-[12.5px] text-muted-foreground">
              {t.directory.sections[section as DirectorySectionKey]}
            </Text>
            <Text className={cn("text-[14.5px] font-semibold", retentionTone(line))}>
              {retentionText(line, t)}
            </Text>
          </View>
        ))}
      </View>
      <Text className="px-1 pt-1.5 text-[12px] text-faint">{copy.retentionFoot}</Text>
    </View>
  );
}

function RecordSection({ profile }: { profile: DirectoryProfile }) {
  const { t } = useTranslation();
  const copy = t.directory.profile;
  const { job } = profile.sections;
  const { account } = profile;
  if (!job && !account && !profile.retention) return null;
  const date = (value: string) => directoryDate(t.common.locale, value);
  const facts: Fact[] = [
    {
      label: copy.type,
      value: isExternalWorker(profile) ? copy.externalWorker : copy.employee,
    },
  ];
  if (job) {
    facts.push({ label: copy.started, value: date(job.spell.startedAt) });
    facts.push({
      label: copy.ended,
      value: job.spell.endedAt ? date(job.spell.endedAt) : copy.current,
    });
  }
  if (account) {
    facts.push({ label: copy.account, value: copy.accountStatuses[account.status] });
    facts.push({ label: copy.signInEmail, value: account.signInEmail });
    facts.push({
      label: copy.directoryRoles,
      value: account.directoryRoles.length
        ? account.directoryRoles.map((role) => copy.directoryRoleNames[role]).join(", ")
        : copy.noDirectoryRoles,
    });
  }
  return (
    <View testID="directory-profile-section-record">
      <Section testID="directory-profile-record-facts" title={copy.record}>
        <Facts t={t} facts={facts} />
      </Section>
      <RetentionBlock profile={profile} />
    </View>
  );
}

/**
 * One scroll in the web's tab order: Overview (Card, Work contact), Job, Contact, Personal,
 * Record. A Section the server leaves out is absent, and nothing here edits.
 */
export function ProfileView({
  profile,
  organization,
  top,
  refreshing,
  onRefresh,
}: {
  profile: DirectoryProfile;
  organization: DirectoryOrganization | undefined;
  /** Above the header, such as the organization picker on "My directory profile". */
  top?: ReactNode;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const viewer = useViewer();
  const [photo, setPhoto] = useState<string | null>(null);
  const lapsed = organization ? organization.enabled && !organization.writable : false;
  return (
    <>
      <ScrollView
        testID="directory-profile-scroll"
        className="flex-1"
        contentContainerClassName="px-4 pb-10"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {top}
        <Header
          profile={profile}
          viewerUserId={viewer?.id ?? null}
          onOpenPhoto={() => setPhoto(profile.sections.photo?.photo?.fullUrl ?? null)}
        />
        {lapsed && organization ? (
          <View className="mt-4">
            <LapsedBanner
              message={t.directory.lapsed(organization.name)}
              adminLine={organization.role !== "MEMBER" ? t.directory.lapsedAdmin : null}
            />
          </View>
        ) : null}
        <SelfNotice profile={profile} organization={organization} />
        <ContactRow profile={profile} />
        <CardSection profile={profile} />
        <WorkContactSection profile={profile} />
        <JobSection profile={profile} />
        <RecordSection profile={profile} />
      </ScrollView>
      <PhotoViewer uri={photo} onClose={() => setPhoto(null)} />
    </>
  );
}

export function ProfileSkeleton() {
  const { t } = useTranslation();
  return (
    <View
      testID="directory-profile-loading"
      accessible
      accessibilityLabel={t.directory.profile.loading}
      className="px-4 pt-2"
    >
      <View className="h-[84px] w-[84px] rounded-full bg-muted" />
      <View className="mt-4 h-6 w-3/5 rounded-full bg-muted" />
      <View className="mt-2 h-4 w-2/5 rounded-full bg-muted" />
      <View className="mt-6 h-16 rounded-[16px] bg-muted" />
      <View className="mt-5 h-40 rounded-[16px] bg-muted" />
    </View>
  );
}

/** One spell's profile, read live and never kept. */
export function ProfileBody({
  organizationId,
  employmentId,
  top,
}: {
  organizationId: string;
  employmentId: string;
  top?: ReactNode;
}) {
  const { t, locale } = useTranslation();
  const read = useDirectoryProfile(organizationId, employmentId, locale);
  const organizations = useDirectoryOrganizations();
  useRereadDirectoryOnFocus();
  const organization = Array.isArray(organizations.data)
    ? organizations.data.find((candidate) => candidate.organizationId === organizationId)
    : undefined;

  if (read.isPending) {
    return (
      <View>
        {top ? <View className="px-4">{top}</View> : null}
        <ProfileSkeleton />
      </View>
    );
  }
  if (read.isError && refused(read.error)) {
    return (
      <View>
        {top ? <View className="px-4">{top}</View> : null}
        <DirectoryNote
          testID="directory-profile-unavailable"
          message={t.directory.profile.notFound}
        />
      </View>
    );
  }
  if (read.isError || !read.data) {
    return (
      <View className="px-4">
        {top}
        <DirectoryOffline onRetry={() => void read.refetch()} />
      </View>
    );
  }
  return (
    <ProfileView
      profile={read.data}
      organization={organization}
      top={top}
      refreshing={read.isRefetching}
      onRefresh={() => void read.refetch()}
    />
  );
}
