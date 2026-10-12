import { Redirect } from "expo-router";
// Entry: LangGate will bounce first-time users to /language. Otherwise go to
// the tabs.
export default function Index() {
  return <Redirect href="/(tabs)" />;
}
