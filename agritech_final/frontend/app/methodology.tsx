import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { colors } from "@/src/theme";
import { useI18n } from "@/src/i18n";
import { useAppStore } from "@/src/store";
import { ImportanceBar } from "@/src/charts";

const FEATURE_LABELS: Record<string, string> = {
  n_score: "Nitrogen (N)",
  p_score: "Phosphorus (P)",
  k_score: "Potassium (K)",
  temperature_score: "Temperature",
  humidity_score: "Humidity",
  ph_score: "Soil pH",
  rainfall_score: "Rainfall",
};

export default function Methodology() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const router = useRouter();
  const s = useAppStore();
  const ml = s.recommendation?.ml_meta;

  const rfImp = ml?.random_forest?.feature_importance ?? {};
  const xgbImp = ml?.xgboost?.feature_importance ?? {};
  const maxRf = Math.max(0.0001, ...(Object.values(rfImp) as number[]));
  const maxXgb = Math.max(0.0001, ...(Object.values(xgbImp) as number[]));

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 24, paddingHorizontal: 16 }}
      testID="methodology-screen"
    >
      <Pressable onPress={() => router.back()} style={styles.back} testID="methodology-back">
        <MaterialCommunityIcons name="chevron-left" size={22} color={colors.onSurface} />
        <Text style={styles.backText}>{t("settings")}</Text>
      </Pressable>

      <Text style={styles.h1}>{t("about_methodology")}</Text>
      <Text style={styles.body}>{t("methodology_body")}</Text>

      <View style={styles.card}>
        <Text style={styles.h2}>{t("ml_performance")}</Text>
        <View style={styles.metricRow}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>Random Forest CV-MAE</Text>
            <Text style={styles.metricVal}>{ml?.random_forest?.cv_mae ?? "-"}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>XGBoost CV-MAE</Text>
            <Text style={styles.metricVal}>{ml?.xgboost?.cv_mae ?? "-"}</Text>
          </View>
        </View>
        <View style={styles.metricRow}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>RF Train R²</Text>
            <Text style={styles.metricVal}>{ml?.random_forest?.train_r2 ?? "-"}</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>XGB Train R²</Text>
            <Text style={styles.metricVal}>{ml?.xgboost?.train_r2 ?? "-"}</Text>
          </View>
        </View>
        <Text style={styles.metricNote}>
          Ensemble weights — RF {ml?.ensemble?.random_forest_weight ?? 0.4}, XGB {ml?.ensemble?.xgboost_weight ?? 0.6}
        </Text>
      </View>

      <View style={styles.card} testID="feature-importance-rf">
        <Text style={styles.h2}>{t("feature_importance")} — Random Forest</Text>
        {Object.entries(rfImp).map(([k, v]) => (
          <ImportanceBar key={k} label={FEATURE_LABELS[k] ?? k} value={v as number} max={maxRf} />
        ))}
      </View>

      <View style={styles.card} testID="feature-importance-xgb">
        <Text style={styles.h2}>{t("feature_importance")} — XGBoost</Text>
        {Object.entries(xgbImp).map(([k, v]) => (
          <ImportanceBar key={k} label={FEATURE_LABELS[k] ?? k} value={v as number} max={maxXgb} />
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>{t("data_sources")}</Text>
        <Text style={styles.body}>{t("data_sources_body")}</Text>
      </View>

      <Text style={styles.footer}>{t("disclaimer")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  back: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  backText: { color: colors.onSurface, fontSize: 14, fontWeight: "600" },
  h1: { color: colors.onSurface, fontSize: 24, fontWeight: "800", marginBottom: 8 },
  h2: { color: colors.onSurface, fontSize: 15, fontWeight: "700", marginBottom: 10 },
  body: { color: colors.onSurfaceSecondary, fontSize: 13, lineHeight: 20, marginBottom: 16 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  metricRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  metric: { flex: 1, backgroundColor: colors.surfaceTertiary, padding: 10, borderRadius: 12 },
  metricLabel: { color: colors.muted, fontSize: 11 },
  metricVal: { color: colors.onSurface, fontSize: 18, fontWeight: "800", marginTop: 4 },
  metricNote: { color: colors.muted, fontSize: 11, marginTop: 6 },
  footer: { color: colors.muted, fontSize: 11, textAlign: "center", marginTop: 8 },
});
