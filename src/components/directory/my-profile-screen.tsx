import { useState } from "react";
import { View } from "react-native";

import { OptionSheet } from "@/components/report/option-sheet";
import { StackScreen } from "@/components/shell/stack-screen";
import { useTranslation } from "@/i18n/use-translation";
import { directoryOrganizations, type DirectoryOrganization } from "@/lib/directory";
import { ApiError, useDirectoryOrganizations, useDirectoryPeople } from "@/lib/query";
import { useViewer } from "@/lib/viewer/use-viewer";

import { OrganizationLine } from "./directory-screen";
import { DirectoryNote, DirectoryOffline } from "./directory-states";
import { ProfileBody, ProfileSkeleton } from "./profile-screen";

const refused = (error: unknown) =>
  error instanceof ApiError && error.status >= 400 && error.status < 500;

/**
 * The backend has no "my profile" route: the viewer's own spell is the list row bound to them,
 * in the organization picked here when they are in more than one directory.
 */
function MyProfile({ organizations }: { organizations: DirectoryOrganization[] }) {
  const { t } = useTranslation();
  const viewer = useViewer();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const organization =
    organizations.find((candidate) => candidate.organizationId === pickedId) ?? organizations[0];
  const people = useDirectoryPeople(organization.organizationId);

  const top = (
    <View className="pb-2">
      <OrganizationLine
        organization={organization}
        pickable={organizations.length > 1}
        onPick={() => setPicking(true)}
      />
    </View>
  );
  const sheet =
    organizations.length > 1 ? (
      <OptionSheet
        testID="directory-organizations"
        open={picking}
        onClose={() => setPicking(false)}
        title={t.directory.pickOrganization}
        options={organizations.map((candidate) => ({
          value: candidate.organizationId,
          label: candidate.name,
        }))}
        picked={[organization.organizationId]}
        onPick={(id) => {
          if (id) setPickedId(id);
          setPicking(false);
        }}
      />
    ) : null;

  const own = people.data?.people.find((person) => person.user.id === viewer?.id);
  const none = (
    <DirectoryNote testID="directory-mine-none" message={t.directory.profile.noOwnProfile} />
  );
  let content;
  if (people.isPending) content = <ProfileSkeleton />;
  else if (people.isError && refused(people.error)) content = none;
  else if (people.isError || !people.data)
    content = (
      <View className="px-4">
        <DirectoryOffline onRetry={() => void people.refetch()} />
      </View>
    );
  else if (own)
    return (
      <>
        <ProfileBody
          key={own.employmentId}
          organizationId={organization.organizationId}
          employmentId={own.employmentId}
          top={top}
        />
        {sheet}
      </>
    );
  else content = none;

  return (
    <>
      <View>
        <View className="px-4">{top}</View>
        {content}
      </View>
      {sheet}
    </>
  );
}

function MyProfileBody() {
  const { t } = useTranslation();
  const organizations = useDirectoryOrganizations();
  if (organizations.isPending) return <ProfileSkeleton />;
  if (organizations.isError || !Array.isArray(organizations.data)) {
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

/** "My directory profile", opened from the viewer block of the More sheet. */
export function MyProfileScreen() {
  const { t } = useTranslation();
  return (
    <StackScreen testID="directory-mine" title={t.directory.profile.mine}>
      <MyProfileBody />
    </StackScreen>
  );
}
