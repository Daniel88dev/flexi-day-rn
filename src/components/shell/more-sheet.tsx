import { SignOutIcon } from "phosphor-react-native";
import { Alert, Modal, Pressable, ScrollView, View } from "react-native";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";
import { cn } from "@/lib/cn";
import type { NavLink, NavSection } from "@/lib/navigation/shell-links";
import { initials } from "@/lib/viewer/viewer";
import type { Viewer } from "@/lib/viewer/use-viewer";

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="px-3 pt-4 pb-1.5 text-[11px] font-bold tracking-[1px] text-faint uppercase">
      {children}
    </Text>
  );
}

function Row({ link, onPress }: { link: NavLink; onPress: (link: NavLink) => void }) {
  return (
    <Pressable
      onPress={() => onPress(link)}
      className="h-12 flex-row items-center gap-3 rounded-2xl px-3 active:opacity-70"
    >
      <Icon icon={link.icon} tone="muted" />
      <Text className="text-[15.5px] font-semibold text-muted-foreground">{link.label}</Text>
    </Pressable>
  );
}

function ViewerBlock({ viewer }: { viewer: Viewer }) {
  return (
    <View className="flex-row items-center gap-3 px-3 py-2">
      <View className="h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-accent">
        <Text className="font-display text-[12px] font-bold text-primary">
          {initials(viewer.name)}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-[14.5px] font-semibold text-foreground">{viewer.name}</Text>
        <Text className="text-[12.5px] text-faint" numberOfLines={1}>
          {viewer.email}
        </Text>
      </View>
    </View>
  );
}

/**
 * Everything the bar has no slot for, plus the viewer and the way out. The bar keeps five slots
 * whatever the viewer administers, so this sheet is where a growing navigation tree goes.
 */
export function MoreSheet({
  open,
  onClose,
  sections,
  utility,
  viewer,
  onNavigate,
  onSignOut,
  className,
}: {
  open: boolean;
  onClose: () => void;
  sections: NavSection[];
  utility: NavLink[];
  viewer: Viewer | null;
  onNavigate: (link: NavLink) => void;
  onSignOut: () => void;
  className?: string;
}) {
  const { t } = useTranslation();

  const confirmSignOut = () =>
    Alert.alert(t.account.signOutTitle, t.account.signOutBody, [
      { text: t.account.cancel, style: "cancel" },
      { text: t.account.signOut, style: "destructive", onPress: onSignOut },
    ]);

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View className={cn("flex-1 justify-end", className)}>
        <Pressable
          accessibilityLabel={t.nav.menu}
          className="absolute inset-0"
          style={{ backgroundColor: "rgba(0,0,0,0.38)" }}
          onPress={onClose}
        />
        <View className="max-h-[80%] rounded-t-[28px] bg-card px-3 pt-2.5 pb-safe">
          <View aria-hidden className="mx-auto mb-2 h-1 w-9 rounded-full bg-border" />
          <ScrollView>
            {sections.map((section) => (
              <View key={section.id}>
                <SectionLabel>{section.label}</SectionLabel>
                {section.links.map((link) => (
                  <Row key={link.key} link={link} onPress={onNavigate} />
                ))}
              </View>
            ))}
            <View className="my-2 h-px bg-border" />
            {utility.map((link) => (
              <Row key={link.key} link={link} onPress={onNavigate} />
            ))}
            <Pressable
              onPress={confirmSignOut}
              className="h-12 flex-row items-center gap-3 rounded-2xl px-3 active:opacity-70"
            >
              <Icon icon={SignOutIcon} tone="danger" />
              <Text className="text-[15.5px] font-semibold text-danger">{t.account.signOut}</Text>
            </Pressable>
            {viewer ? (
              <View className="mt-1 border-t border-border pt-1">
                <ViewerBlock viewer={viewer} />
              </View>
            ) : null}
          </ScrollView>
          <View className="h-5" />
        </View>
      </View>
    </Modal>
  );
}
