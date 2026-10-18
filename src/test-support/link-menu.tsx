import { createContext, use, useMemo, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

const FakeMenuContext = createContext<{ open: boolean; setOpen: (open: boolean) => void }>({
  open: false,
  setOpen: () => {},
});
const SubmenuContext = createContext(false);

function Trigger({ children }: { children: ReactNode }) {
  const { setOpen } = use(FakeMenuContext);
  return <Pressable onLongPress={() => setOpen(true)}>{children}</Pressable>;
}

function Menu({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  const { open } = use(FakeMenuContext);
  const submenu = use(SubmenuContext);
  const rows = (
    <View accessibilityLabel={title} accessibilityHint={subtitle}>
      {title ? <Text>{title}</Text> : null}
      {subtitle ? <Text>{subtitle}</Text> : null}
      {children}
    </View>
  );
  if (submenu) return rows;
  if (!open) return null;
  return (
    <SubmenuContext value>
      <View testID="link-menu">{rows}</View>
    </SubmenuContext>
  );
}

function MenuAction({
  title,
  subtitle,
  disabled,
  onPress,
}: {
  title: string;
  subtitle?: string;
  disabled?: boolean;
  destructive?: boolean;
  onPress?: () => void;
}) {
  const { setOpen } = use(FakeMenuContext);
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={() => {
        setOpen(false);
        onPress?.();
      }}
    >
      <Text>{title}</Text>
      {subtitle ? <Text>{subtitle}</Text> : null}
    </Pressable>
  );
}

/**
 * Expo Router's `Link` with `Link.Menu`, which needs the router's native preview context and has
 * none in Jest. A long-press on the trigger shows the menu as plain rows (`testID` `link-menu`); a
 * row closes it and runs its action. A tap stays with the trigger's own press.
 */
function FakeLinkImpl({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return <FakeMenuContext value={value}>{children}</FakeMenuContext>;
}

export const FakeLink = Object.assign(FakeLinkImpl, { Trigger, Menu, MenuAction });
