import { Redirect } from "expo-router";

import { useRootRoute } from "@/lib/session/root-route-context";

export default function Index() {
  return <Redirect href={useRootRoute() === "signed-in" ? "/dashboard" : "/welcome"} />;
}
