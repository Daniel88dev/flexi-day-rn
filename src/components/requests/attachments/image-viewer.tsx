import { XIcon } from "phosphor-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  useWindowDimensions,
  View,
} from "react-native";

import { Text } from "@/components/ui/text";
import { useTranslation } from "@/i18n/use-translation";

// The viewer is always dark, whatever the system says: a photo reads best on near-black.
const BACKDROP = "#0b0b0e";

export function ImageViewer({
  image,
  onClose,
}: {
  image: { url: string; fileName: string } | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  // Keyed by URL: every tap brings a fresh one, so an earlier image's outcome never carries over.
  const [outcome, setOutcome] = useState<{ url: string; shown: boolean } | null>(null);
  const state =
    image && outcome?.url === image.url ? (outcome.shown ? "shown" : "failed") : "loading";

  return (
    <Modal
      visible={image !== null}
      animationType="fade"
      presentationStyle="overFullScreen"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" />
      <View testID="image-viewer" className="flex-1" style={{ backgroundColor: BACKDROP }}>
        {image ? (
          <ScrollView
            className="flex-1"
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ width, height }}
          >
            <Image
              testID="image-viewer-image"
              source={{ uri: image.url }}
              accessibilityLabel={image.fileName}
              resizeMode="contain"
              style={{ width, height }}
              onLoad={() => setOutcome({ url: image.url, shown: true })}
              onError={() => setOutcome({ url: image.url, shown: false })}
            />
          </ScrollView>
        ) : null}
        {state === "loading" ? (
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
            <ActivityIndicator color="#ffffff" />
          </View>
        ) : null}
        {state === "failed" ? (
          <View pointerEvents="none" className="absolute inset-0 items-center justify-center px-10">
            <Text className="text-center text-[15px]" style={{ color: "#d6d6dc" }}>
              {t.attachments.imageFailed}
            </Text>
          </View>
        ) : null}
        <View className="absolute top-0 right-0 left-0 flex-row items-center gap-3 px-4 pt-safe">
          <Pressable
            testID="image-viewer-close"
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t.attachments.close}
            className="mt-3 h-10 w-10 items-center justify-center rounded-full active:opacity-70"
            style={{ backgroundColor: "rgba(255,255,255,0.14)" }}
          >
            <XIcon color="#f4f4f7" size={18} weight="bold" />
          </Pressable>
          <Text
            className="flex-1 pt-3 pr-12 text-[15px] font-semibold"
            style={{ color: "#f4f4f7" }}
            numberOfLines={1}
          >
            {image?.fileName ?? ""}
          </Text>
        </View>
      </View>
    </Modal>
  );
}
