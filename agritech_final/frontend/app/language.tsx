import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { colors } from "@/src/theme";
import { Lang, useI18n } from "@/src/i18n";

const OPTIONS: { code: Lang; label: string; sub: string }[] = [
  { code: "en", label: "English", sub: "Get started in English" },
  { code: "te", label: "తెలుగు", sub: "తెలుగులో ప్రారంభించండి" },
  { code: "hi", label: "हिंदी", sub: "हिंदी में शुरू करें" },
];

export default function LanguageScreen() {
  const [choice, setChoice] = useState<Lang>("en");
  const { setLang } = useI18n();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const onContinue = async () => {
    await setLang(choice);
    router.replace("/(tabs)");
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 32 }]} testID="language-screen">
      <View style={styles.logoWrap}>
        <MaterialCommunityIcons name="sprout" size={56} color={colors.brandPrimary} />
        <Text style={styles.brand}>AquaCrop AI</Text>
        <Text style={styles.tagline}>Groundwater-Aware Crop Advisory</Text>
      </View>

      <Text style={styles.heading}>Choose your language</Text>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {OPTIONS.map((o) => {
          const selected = choice === o.code;
          return (
            <Pressable
              key={o.code}
              onPress={() => setChoice(o.code)}
              testID={`lang-option-${o.code}`}
              style={[styles.card, selected && styles.cardSelected]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.cardLabel}>{o.label}</Text>
                <Text style={styles.cardSub}>{o.sub}</Text>
              </View>
              <MaterialCommunityIcons
                name={selected ? "check-circle" : "circle-outline"}
                size={24}
                color={selected ? colors.brandPrimary : colors.muted}
              />
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable
        onPress={onContinue}
        style={[styles.cta, { marginBottom: insets.bottom + 16 }]}
        testID="language-continue-button"
      >
        <Text style={styles.ctaText}>Continue</Text>
        <MaterialCommunityIcons name="arrow-right" size={20} color={colors.onBrandPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: 20 },
  logoWrap: { alignItems: "center", marginBottom: 24 },
  brand: { color: colors.onSurface, fontSize: 24, fontWeight: "800", marginTop: 8 },
  tagline: { color: colors.muted, fontSize: 13, marginTop: 4 },
  heading: { color: colors.onSurface, fontSize: 22, fontWeight: "700", marginTop: 8, marginBottom: 16 },
  card: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surfaceSecondary, padding: 20, borderRadius: 20,
    borderWidth: 1.5, borderColor: colors.border, marginBottom: 12,
  },
  cardSelected: { borderColor: colors.brandPrimary, backgroundColor: colors.surfaceTertiary },
  cardLabel: { color: colors.onSurface, fontSize: 20, fontWeight: "700" },
  cardSub: { color: colors.muted, fontSize: 13, marginTop: 4 },
  cta: {
    backgroundColor: colors.brandPrimary, paddingVertical: 16, borderRadius: 999,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  ctaText: { color: colors.onBrandPrimary, fontSize: 17, fontWeight: "700" },
});
