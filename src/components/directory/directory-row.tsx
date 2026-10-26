import { router } from "expo-router";
import { Image, Pressable, View } from "react-native";

import { Text } from "@/components/ui/text";
import type { Dictionary } from "@/i18n";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import {
  directoryDate,
  labelName,
  rowMarkers,
  rowPicture,
  type DirectoryPerson,
  type FormerDirectoryPerson,
  type RowMarker,
} from "@/lib/directory";

const MARKER_TONE: Record<RowMarker, { surface: string; text: string }> = {
  RETENTION_HOLD: { surface: "bg-warm-soft", text: "text-warm" },
  EXTERNAL_WORKER: { surface: "bg-accent", text: "text-primary" },
  NO_ACCOUNT: { surface: "bg-muted", text: "text-muted-foreground" },
  INVITE_SENT: { surface: "bg-accent", text: "text-primary" },
  ACCOUNT_DELETED: { surface: "bg-danger-soft", text: "text-danger" },
  REJOINED: { surface: "bg-accent", text: "text-primary" },
  YOU: { surface: "bg-ok-soft", text: "text-ok" },
};

/**
 * The directory's picture: the Profile photo, then the Account picture, then the initials in the
 * person's colour. `uri` overrides the list's small link, as the profile header's full size does.
 */
export function DirectoryAvatar({
  person,
  uri: override,
  size = 40,
}: {
  person: DirectoryPerson;
  uri?: string | null;
  size?: number;
}) {
  const round = { width: size, height: size, borderRadius: size / 2 };
  const uri = override === undefined ? rowPicture(person) : override;
  if (uri) {
    return <Image source={{ uri }} style={round} accessibilityIgnoresInvertColors />;
  }
  return (
    <View
      style={{ ...round, backgroundColor: person.user.avatarColor }}
      className="items-center justify-center"
    >
      <Text style={{ fontSize: size * 0.36, color: "#fff" }} className="font-semibold">
        {person.user.initials || "?"}
      </Text>
    </View>
  );
}

/** `withTestIDs` only outside a pressable, where iOS would hide them; a row's label reads them. */
export function Markers({
  markers,
  t,
  withTestIDs = false,
}: {
  markers: RowMarker[];
  t: Dictionary;
  withTestIDs?: boolean;
}) {
  if (markers.length === 0) return null;
  return (
    <View className="mt-1 flex-row flex-wrap gap-1">
      {markers.map((marker) => (
        <View
          key={marker}
          testID={withTestIDs ? `directory-marker-${marker}` : undefined}
          className={cn("rounded-full px-2 py-0.5", MARKER_TONE[marker].surface)}
        >
          <Text className={cn("text-[11.5px] font-semibold", MARKER_TONE[marker].text)}>
            {t.directory.markers[marker]}
          </Text>
        </View>
      ))}
    </View>
  );
}

export const openProfile = (organizationId: string, employmentId: string) =>
  router.push({ pathname: "/directory/[employmentId]", params: { employmentId, organizationId } });

function Row({
  testID,
  person,
  organizationId,
  lines,
  markers,
  first,
}: {
  testID: string;
  person: DirectoryPerson;
  organizationId: string;
  lines: string[];
  markers: RowMarker[];
  first: boolean;
}) {
  const { t } = useTranslation();
  const label = [person.name, ...lines, ...markers.map((marker) => t.directory.markers[marker])];
  return (
    <Pressable
      testID={testID}
      onPress={() => openProfile(organizationId, person.employmentId)}
      accessibilityRole="button"
      accessibilityLabel={label.join(", ")}
      className={cn(
        "flex-row items-center gap-3 px-4 py-3 active:opacity-70",
        !first && "border-t border-border"
      )}
    >
      <DirectoryAvatar person={person} />
      <View className="flex-1">
        <Text className="text-[15.5px] font-semibold text-foreground">{person.name}</Text>
        {lines.map((line) => (
          <Text key={line} className="text-[13px] leading-[18px] text-muted-foreground">
            {line}
          </Text>
        ))}
        <Markers markers={markers} t={t} />
      </View>
    </Pressable>
  );
}

export function PersonRow({
  person,
  organizationId,
  viewerUserId,
  first,
}: {
  person: DirectoryPerson;
  organizationId: string;
  viewerUserId: string | null;
  first: boolean;
}) {
  const { t } = useTranslation();
  const detail = [
    person.jobTitle,
    person.department ? labelName(person.department, t.directory.archived) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Row
      testID={`directory-row-${person.employmentId}`}
      person={person}
      organizationId={organizationId}
      lines={detail ? [detail] : []}
      markers={rowMarkers(person, viewerUserId)}
      first={first}
    />
  );
}

export function FormerRow({
  person,
  organizationId,
  viewerUserId,
  first,
}: {
  person: FormerDirectoryPerson;
  organizationId: string;
  viewerUserId: string | null;
  first: boolean;
}) {
  const { t } = useTranslation();
  const { locale } = t.common;
  const ended = person.endedAt ? t.directory.ended(directoryDate(locale, person.endedAt)) : null;
  const lines = [[person.jobTitle, ended].filter(Boolean).join(" · ")];
  const removal = person.nextRemoval;
  if (removal) {
    lines.push(
      t.directory.nextRemoval(
        t.directory.sections[removal.section],
        directoryDate(locale, removal.date)
      )
    );
  }
  return (
    <Row
      testID={`directory-former-row-${person.employmentId}`}
      person={person}
      organizationId={organizationId}
      lines={lines}
      markers={rowMarkers(person, viewerUserId)}
      first={first}
    />
  );
}
