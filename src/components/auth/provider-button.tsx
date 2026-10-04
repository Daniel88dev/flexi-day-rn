import { AppleLogoIcon } from "phosphor-react-native";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, useColorScheme } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import { useTone } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import type { SocialProvider } from "@/lib/auth/providers";
import { cn } from "@/lib/cn";

type ProviderLook = {
  surfaceClassName?: string;
  surfaceColor?: string;
  ink: string;
  mark: (ink: string) => ReactNode;
};

function lookOf(provider: SocialProvider, dark: boolean, foreground: string): ProviderLook {
  const outlined = { surfaceClassName: "border border-input bg-card", ink: foreground };
  const looks: Record<SocialProvider, ProviderLook> = {
    apple: {
      surfaceColor: dark ? "#ffffff" : "#000000",
      ink: dark ? "#000000" : "#ffffff",
      mark: (ink) => <AppleLogoIcon color={ink} size={20} weight="fill" />,
    },
    google: { ...outlined, mark: () => <GoogleMark /> },
    microsoft: { ...outlined, mark: () => <MicrosoftMark /> },
  };
  return looks[provider];
}

export function ProviderButton({
  provider,
  label,
  loading,
  disabled,
  onPress,
  testID,
}: {
  provider: SocialProvider;
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  testID: string;
}) {
  const dark = useColorScheme() === "dark";
  const foreground = useTone("foreground");
  const look = lookOf(provider, dark, foreground);
  const inactive = disabled || loading;
  const pressableProps = {
    testID,
    onPress,
    disabled: inactive,
    accessibilityRole: "button" as const,
    accessibilityLabel: label,
    accessibilityState: { disabled: !!inactive, busy: !!loading },
  };

  return (
    <Pressable
      {...pressableProps}
      className={cn(
        "h-14 w-full flex-row items-center justify-center gap-2.5 rounded-full px-6 active:opacity-80",
        look.surfaceClassName,
        disabled && !loading && "opacity-50"
      )}
      style={look.surfaceColor ? { backgroundColor: look.surfaceColor } : undefined}
    >
      {loading ? <ActivityIndicator color={look.ink} /> : look.mark(look.ink)}
      <Text className="text-[16px] font-semibold" style={{ color: look.ink }}>
        {label}
      </Text>
    </Pressable>
  );
}

function GoogleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M22.5 12.2c0-.7-.06-1.4-.18-2.06H12v3.9h5.9a5 5 0 0 1-2.18 3.3v2.74h3.52c2.06-1.9 3.26-4.7 3.26-7.88z"
      />
      <Path
        fill="#34A853"
        d="M12 23c2.94 0 5.4-.97 7.2-2.63l-3.52-2.73c-.98.66-2.23 1.05-3.68 1.05-2.83 0-5.23-1.91-6.09-4.48H2.27v2.82A11 11 0 0 0 12 23z"
      />
      <Path fill="#FBBC05" d="M5.91 14.21a6.6 6.6 0 0 1 0-4.42V6.97H2.27a11 11 0 0 0 0 9.86z" />
      <Path
        fill="#EA4335"
        d="M12 5.5c1.6 0 3.03.55 4.16 1.62l3.12-3.12C17.4 2.2 14.94 1.2 12 1.2A11 11 0 0 0 2.27 6.97l3.64 2.82C6.77 7.4 9.17 5.5 12 5.5z"
      />
    </Svg>
  );
}

function MicrosoftMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 100 100">
      <Rect x="4" y="4" width="43" height="43" fill="#F25022" />
      <Rect x="53" y="4" width="43" height="43" fill="#7FBA00" />
      <Rect x="4" y="53" width="43" height="43" fill="#00A4EF" />
      <Rect x="53" y="53" width="43" height="43" fill="#FFB900" />
    </Svg>
  );
}
