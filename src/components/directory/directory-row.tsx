import { Image, View } from "react-native";

import { Text } from "@/components/ui/text";
import type { Dictionary } from "@/i18n";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import {
  directoryDate,
  rowMarkers,
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

/** The Account picture when there is one, otherwise the initials in the person's colour. */
export function DirectoryAvatar({ person, size = 40 }: { person: DirectoryPerson; size?: number }) {
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (person.image) {
    return <Image source={{ uri: person.image }} style={round} accessibilityIgnoresInvertColors />;
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

function Markers({ markers, t }: { markers: RowMarker[]; t: Dictionary }) {
  if (markers.length === 0) return null;
  return (
    <View className="mt-1 flex-row flex-wrap gap-1">
      {markers.map((marker) => (
        <View
          key={marker}
          testID={`directory-marker-${marker}`}
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

function Row({
  testID,
  person,
  lines,
  markers,
  first,
}: {
  testID: string;
  person: DirectoryPerson;
  lines: string[];
  markers: RowMarker[];
  first: boolean;
}) {
  const { t } = useTranslation();
  const label = [person.name, ...lines, ...markers.map((marker) => t.directory.markers[marker])];
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={label.join(", ")}
      className={cn("flex-row items-center gap-3 px-4 py-3", !first && "border-t border-border")}
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
    </View>
  );
}

export function PersonRow({
  person,
  viewerUserId,
  first,
}: {
  person: DirectoryPerson;
  viewerUserId: string | null;
  first: boolean;
}) {
  const detail = [person.jobTitle, person.department?.name].filter(Boolean).join(" · ");
  return (
    <Row
      testID={`directory-row-${person.employmentId}`}
      person={person}
      lines={detail ? [detail] : []}
      markers={rowMarkers(person, viewerUserId)}
      first={first}
    />
  );
}

export function FormerRow({
  person,
  viewerUserId,
  first,
}: {
  person: FormerDirectoryPerson;
  viewerUserId: string | null;
  first: boolean;
}) {
  const { t } = useTranslation();
  const { locale } = t.common;
  const ended = t.directory.ended(directoryDate(locale, person.endedAt));
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
      lines={lines}
      markers={rowMarkers(person, viewerUserId)}
      first={first}
    />
  );
}
