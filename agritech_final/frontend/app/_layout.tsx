import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { LogBox } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";
import { I18nProvider, useI18n } from "@/src/i18n";
import { AppStoreProvider } from "@/src/store";

// Preserve icon prewarming logic if it existed (none in original layout).
LogBox.ignoreAllLogs(true);

function LangGate({ children }: { children: React.ReactNode }) {
  const { lang } = useI18n();
  const segs = useSegments();
  const router = useRouter();
  useEffect(() => {
    const first = segs[0];
    if (!lang && first !== "language") {
      router.replace("/language");
    } else if (lang && first === "language") {
      router.replace("/");
    }
  }, [lang, segs, router]);
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <I18nProvider>
            <AppStoreProvider>
              <StatusBar style="light" />
              <LangGate>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: "#0E140D" },
                  }}
                />
              </LangGate>
            </AppStoreProvider>
          </I18nProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
