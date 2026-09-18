import { Redirect } from "expo-router";

// PROTOTYPE branch: the app opens on the dashboard-shell prototype.
export default function Index() {
  return <Redirect href="/prototype/shell" />;
}
