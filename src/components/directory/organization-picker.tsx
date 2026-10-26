import { CaretDownIcon } from "phosphor-react-native";
import { useState } from "react";
import { Pressable } from "react-native";

import { OptionSheet } from "@/components/report/option-sheet";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import type { DirectoryOrganization } from "@/lib/directory";

/** The organization under the title, a picker with its sheet once there is more than one. */
export function OrganizationPicker({
  organizations,
  organization,
  onPick,
}: {
  organizations: DirectoryOrganization[];
  organization: DirectoryOrganization;
  onPick: (organizationId: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (organizations.length < 2) {
    return (
      <Text testID="directory-organization" className="mt-0.5 text-[14px] text-muted-foreground">
        {organization.name}
      </Text>
    );
  }
  return (
    <>
      <Pressable
        testID="directory-organization-picker"
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${t.directory.pickOrganization}, ${organization.name}`}
        hitSlop={6}
        className="mt-0.5 flex-row items-center gap-1 self-start active:opacity-70"
      >
        <Text className="text-[14.5px] font-semibold text-primary">{organization.name}</Text>
        <Icon icon={CaretDownIcon} tone="primary" size={12} weight="bold" />
      </Pressable>
      <OptionSheet
        testID="directory-organizations"
        open={open}
        onClose={() => setOpen(false)}
        title={t.directory.pickOrganization}
        options={organizations.map((candidate) => ({
          value: candidate.organizationId,
          label: candidate.name,
        }))}
        picked={[organization.organizationId]}
        onPick={(id) => {
          setOpen(false);
          if (id) onPick(id);
        }}
      />
    </>
  );
}
