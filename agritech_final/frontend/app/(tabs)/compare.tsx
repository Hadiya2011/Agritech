import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/src/theme";
import { useI18n } from "@/src/i18n";
import { useAppStore } from "@/src/store";
import { GroupedBarChart, LineChart } from "@/src/charts";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";

function statusColor(s?: string) {
  if (s === "depleting") return colors.error;
  if (s === "improving") return colors.success;
  return colors.warning;
}

export default function Compare() {
  const insets = useSafeAreaInsets();
  const { t, cropName } = useI18n();
  const s = useAppStore();

  if (s.loading || !s.recommendation || !s.groundwater) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brandPrimary} size="large" />
        <Text style={styles.loadingText}>{t("loading_recommendation")}</Text>
      </View>
    );
  }

  const yearlyPoints = Object.entries(s.groundwater.yearly)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([y, v]) => ({ x: y, y: v }));

  const comparison = s.recommendation.comparison;
  const summary = s.recommendation.summary;

  const gwStatusText = t((s.groundwater.status ?? "stable") as any);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 24, paddingHorizontal: 16 }}
      testID="compare-screen"
    >
      <Text style={styles.header}>{t("compare_title")}</Text>
      <Text style={styles.sub}>{s.location?.district}, {s.location?.state}</Text>

      {/* Groundwater trend card */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>{t("groundwater_trend")}</Text>
          <View style={[styles.badge, { backgroundColor: statusColor(s.groundwater.status) }]}>
            <Text style={styles.badgeText}>{gwStatusText}</Text>
          </View>
        </View>
        <Text style={styles.mbgl}>{s.groundwater.current_mbgl} <Text style={styles.mbglUnit}>mbgl</Text></Text>
        <Text style={styles.mbglNote}>{t("mbgl")} · slope {s.groundwater.slope > 0 ? "+" : ""}{s.groundwater.slope}/yr</Text>
        <View style={{ marginTop: 8 }}>
          <LineChart points={yearlyPoints} unit="mbgl" />
        </View>
      </View>

      {/* Grouped bar chart */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("with_groundwater")} vs {t("without_groundwater")}</Text>
        <View style={{ marginTop: 12, alignItems: "center" }}>
          <GroupedBarChart
            labels={comparison.map((c) => cropName(c.crop))}
            with_values={comparison.map((c) => c.score_with)}
            without_values={comparison.map((c) => c.score_without)}
            withLabel={t("with_groundwater")}
            withoutLabel={t("without_groundwater")}
          />
        </View>
      </View>

      {/* Rank change list */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("rank_change")}</Text>
        {comparison.map((c) => {
          const change = c.rank_change; // +ve = moved up when GW considered
          const arrow = change > 0 ? "arrow-up-bold" : change < 0 ? "arrow-down-bold" : "minus";
          const color = change > 0 ? colors.success : change < 0 ? colors.error : colors.muted;
          return (
            <View key={c.crop} style={styles.rankRow} testID={`rank-row-${c.crop}`}>
              <Text style={styles.rankName}>{cropName(c.crop)}</Text>
              <View style={styles.rankNums}>
                <Text style={styles.rankSmall}>#{c.rank_without} → #{c.rank_with}</Text>
                <View style={styles.rankChangeBox}>
                  <MaterialCommunityIcons name={arrow as any} size={14} color={color} />
                  <Text style={[styles.rankChangeText, { color }]}>{Math.abs(change)}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Textual explanation */}
      <View style={[styles.card, { backgroundColor: colors.brandTertiary, borderColor: colors.brandPrimary }]} testID="explanation-card">
        <Text style={styles.explainText}>
          {t("comparison_explanation_intro")}{" "}
          <Text style={styles.explainBold}>{cropName(summary.top_without)}</Text>{" "}
          {t("comparison_explanation_first")}{" "}
          {t("comparison_explanation_gw")},{" "}
          {t("comparison_explanation_moves")}{" "}
          <Text style={styles.explainBold}>{cropName(summary.top_with)}</Text>{" "}
          {t("comparison_explanation_because")}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, gap: 12 },
  loadingText: { color: colors.muted, fontSize: 14 },
  header: { color: colors.onSurface, fontSize: 22, fontWeight: "800" },
  sub: { color: colors.muted, fontSize: 13, marginBottom: 12 },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  cardTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { color: "#000", fontSize: 12, fontWeight: "800" },
  mbgl: { color: colors.onSurface, fontSize: 30, fontWeight: "900", marginTop: 8 },
  mbglUnit: { color: colors.muted, fontSize: 13 },
  mbglNote: { color: colors.muted, fontSize: 11 },
  rankRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomColor: colors.divider, borderBottomWidth: 0.5 },
  rankName: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  rankNums: { flexDirection: "row", alignItems: "center", gap: 10 },
  rankSmall: { color: colors.muted, fontSize: 12 },
  rankChangeBox: { flexDirection: "row", alignItems: "center", gap: 2 },
  rankChangeText: { fontSize: 12, fontWeight: "800" },
  explainText: { color: colors.onBrandTertiary, fontSize: 14, lineHeight: 20 },
  explainBold: { fontWeight: "800", color: colors.onSurface },
});
