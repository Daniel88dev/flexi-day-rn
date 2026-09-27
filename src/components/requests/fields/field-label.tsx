import { Text } from "@/components/ui/text";

export function FieldLabel({ children }: { children: string }) {
  return (
    <Text className="mb-2 px-1 text-[13px] font-semibold text-muted-foreground">{children}</Text>
  );
}
