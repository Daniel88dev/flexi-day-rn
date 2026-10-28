import { useState } from "react";
import { View } from "react-native";

import { StackScreen } from "@/components/shell/stack-screen";
import { useTranslation } from "@/i18n/use-translation";
import { directoryOrganizations, type DirectoryOrganization } from "@/lib/directory";
import { refusedRead, useDirectoryOrganizations, useDirectoryPeople } from "@/lib/query";
import { useViewer } from "@/lib/viewer/use-viewer";

import { DirectoryNote, DirectoryOffline } from "./directory-states";
import { OrganizationPicker } from "./organization-picker";
import { ProfileBody, ProfileSkeleton } from "./profile-screen";

/**
 * The backend has no "my profile" route: the viewer's own spell is the list row bound to them,
 * in the organization picked here when they are in more than one directory.
 */
function MyProfile({ organizations }: { organizations: DirectoryOrganization[] }) {
  const { t } = useTranslation();
  const viewer = useViewer();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const organization =
    organizations.find((candidate) => candidate.organizationId === pickedId) ?? organizations[0];
  const people = useDirectoryPeople(organization.organizationId);

  const top = (
    <View className="pb-2">
      <OrganizationPicker
        organizations={organizations}
        organization={organization}
        onPick={setPickedId}
      />
    </View>
  );

  const own = viewer
    ? people.data?.people.find((person) => person.user.id === viewer.id)
    : undefined;
  const none = (
    <DirectoryNote testID="directory-mine-none" message={t.directory.profile.noOwnProfile} />
  );
  let content;
  if (people.isPending) content = <ProfileSkeleton />;
  else if (people.isError && refusedRead(people.error)) content = none;
  else if (people.isError || !people.data)
    content = (
      <View className="px-4">
        <DirectoryOffline onRetry={() => void people.refetch()} />
      </View>
    );
  else if (own)
    return (
      <ProfileBody
        key={own.employmentId}
        profileRef={{
          organizationId: organization.organizationId,
          employmentId: own.employmentId,
        }}
        top={top}
      />
    );
  else content = none;

  return (
    <View>
      <View className="px-4">{top}</View>
      {content}
    </View>
  );
}

function MyProfileBody() {
  const { t } = useTranslation();
  const organizations = useDirectoryOrganizations();
  if (organizations.isPending) return <ProfileSkeleton />;
  if (organizations.isError) {
    return (
      <View className="px-4">
        <DirectoryOffline onRetry={() => void organizations.refetch()} />
      </View>
    );
  }
  const open = directoryOrganizations(organizations.data);
  if (open.length === 0) {
    return <DirectoryNote testID="directory-unavailable" message={t.directory.unavailable} />;
  }
  return <MyProfile organizations={open} />;
}

export function MyProfileScreen() {
  const { t } = useTranslation();
  return (
    <StackScreen testID="directory-mine" title={t.directory.profile.mine}>
      <MyProfileBody />
    </StackScreen>
  );
}
