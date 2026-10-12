import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState } from "react";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { colors } from "@/src/theme";
import { Lang, useI18n } from "@/src/i18n";
import { useAppStore } from "@/src/store";

function Row({ icon, title, subtitle, right, onPress, testID }: any) {
  return (
    <Pressable style={styles.row} onPress={onPress} testID={testID}>
      <View style={styles.iconBox}>
        <MaterialCommunityIcons name={icon} size={20} color={colors.brandSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
      </View>
      {right}
    </Pressable>
  );
}

export default function Settings() {
  const insets = useSafeAreaInsets();
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const s = useAppStore();
  const [voice, setVoice] = useState(true);

  const cycleLang = () => {
    const order: Lang[] = ["en", "te", "hi"];
    const next = order[(order.indexOf((lang ?? "en") as Lang) + 1) % order.length];
    setLang(next);
  };

  const currentLabel = lang === "te" ? "తెలుగు" : lang === "hi" ? "हिंदी" : "English";

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 24, paddingHorizontal: 16 }}
      testID="settings-screen"
    >
      <Text style={styles.header}>{t("settings")}</Text>

      <View style={styles.card}>
        <Row
          icon="translate"
          title={t("change_language")}
          subtitle={currentLabel}
          right={<MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />}
          onPress={cycleLang}
          testID="settings-change-language"
        />
        <View style={styles.divider} />
        <Row
          icon="volume-high"
          title={t("voice_readout")}
          right={<Switch value={voice} onValueChange={setVoice}
            trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }}
            thumbColor="#fff" testID="voice-toggle" />}
          testID="settings-voice-toggle-row"
        />
      </View>

      {/* Save-my-farm card */}
      <View style={styles.card}>
        <Row
          icon={s.savedFarm ? "pin" : "pin-outline"}
          title={t("saved_farm")}
          subtitle={
            s.savedFarm
              ? `${s.savedFarm.location.district}, ${s.savedFarm.location.state}`
              : t("no_saved_farm")
          }
          right={
            s.savedFarm ? (
              <Pressable style={styles.smallBtn} onPress={s.unpinFarm} testID="settings-unpin-farm">
                <Text style={styles.smallBtnText}>{t("unpin_farm")}</Text>
              </Pressable>
            ) : (
              <Pressable style={[styles.smallBtn, { backgroundColor: colors.brandPrimary }]} onPress={s.pinFarm} testID="settings-pin-farm">
                <Text style={[styles.smallBtnText, { color: colors.onBrandPrimary }]}>{t("pin_this_farm")}</Text>
              </Pressable>
            )
          }
        />
      </View>

      {/* Demo mode card */}
      <View style={styles.card}>
        <Row
          icon="flask-outline"
          title={t("demo_mode_row")}
          subtitle={
            s.demoPreset
              ? `${t("demo_mode")}: ${s.demoPreset.label}`
              : t("demo_mode_hint")
          }
          right={
            s.demoPreset ? (
              <Pressable style={styles.smallBtn} onPress={s.exitDemo} testID="settings-demo-exit">
                <Text style={styles.smallBtnText}>{t("demo_exit")}</Text>
              </Pressable>
            ) : null
          }
          onPress={s.cycleDemo}
          testID="settings-demo-cycle"
        />
      </View>

      <View style={styles.card}>
        <Row
          icon="brain"
          title={t("about_methodology")}
          right={<MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />}
          onPress={() => router.push("/methodology")}
          testID="settings-methodology"
        />
        <View style={styles.divider} />
        <Row
          icon="database"
          title={t("data_sources")}
          subtitle={t("data_sources_body")}
          testID="settings-data-sources"
        />
      </View>

      <Text style={styles.disclaimer}>{t("disclaimer")}</Text>
      <Text style={styles.version}>{t("version")} 1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { color: colors.onSurface, fontSize: 24, fontWeight: "800", marginBottom: 16 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: 20, padding: 4, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: "row", alignItems: "center", padding: 12, gap: 12 },
  iconBox: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  rowTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  rowSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  divider: { height: 0.5, backgroundColor: colors.divider, marginLeft: 60 },
  smallBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.surfaceTertiary },
  smallBtnText: { color: colors.onSurface, fontSize: 11, fontWeight: "700" },
  disclaimer: { color: colors.muted, fontSize: 11, textAlign: "center", marginTop: 20 },
  version: { color: colors.muted, fontSize: 11, textAlign: "center", marginTop: 4 },
});
