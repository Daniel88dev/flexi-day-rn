import { useEffect, useState } from "react";
import { Text } from "react-native";

import { API_URL } from "@/lib/api";

type Status = "checking" | "reachable" | "unreachable";

const LABEL: Record<Status, string> = {
  checking: "Checking backend",
  reachable: "Backend reachable",
  unreachable: "Backend unreachable",
};

export function BackendStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/health`)
      .then((res) => {
        if (!cancelled) setStatus(res.ok ? "reachable" : "unreachable");
      })
      .catch(() => {
        if (!cancelled) setStatus("unreachable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Text className="text-center text-sm text-muted-foreground">
      {LABEL[status]} · {API_URL}
    </Text>
  );
}
