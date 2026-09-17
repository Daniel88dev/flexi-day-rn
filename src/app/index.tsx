import { Redirect } from "expo-router";

// PROTOTYPE branch: the app opens on the welcome-screen prototype.
export default function Index() {
  return <Redirect href="/prototype/welcome" />;
}
