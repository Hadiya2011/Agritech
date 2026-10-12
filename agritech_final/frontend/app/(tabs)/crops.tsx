import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { colors } from "@/src/theme";
import { useI18n } from "@/src/i18n";
import { useAppStore } from "@/src/store";
import { Crop } from "@/src/api";
import { useVoiceRead } from "@/src/voice";

const RISK_COLOR = { low: colors.success, moderate: colors.warning, high: colors.error };
const DEMAND_ICON: Record<string, string> = { low: "water-outline", moderate: "water", high: "water-alert" };

function medal(rank: number) {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
}

function CropCard({ crop }: { crop: Crop }) {
  const { t, cropName, lang } = useI18n();
  const { state, speak, stop } = useVoiceRead();
  const reasons = crop.reasons ?? [];

  const explanation = [
    ...reasons.map((r) => t(("reason_" + r) as any)),
  ].join(" ");

  const speakText = `${cropName(crop.crop)}. ${t("suitability_score")}: ${crop.score_with_groundwater}. ` +
    `${t("water_demand")}: ${t(crop.water_demand as any)}. ${t("groundwater_risk")}: ${t(crop.groundwater_risk as any)}. ${explanation}`;

  return (
    <View style={styles.card} testID={`crop-card-${crop.crop}`}>
      <View style={styles.cardTop}>
        <Text style={styles.medal}>{medal(crop.rank)}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.cropName}>{cropName(crop.crop)}</Text>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreNum}>{crop.score_with_groundwater}</Text>
            <Text style={styles.scoreDen}>/100</Text>
            <Text style={styles.scoreLabel}>{t("suitability")}</Text>
          </View>
        </View>
      </View>

      <View style={styles.chips}>
        <View style={[styles.chip, { backgroundColor: colors.surfaceTertiary }]}>
          <MaterialCommunityIcons name={DEMAND_ICON[crop.water_demand] as any} size={14} color={colors.brandSecondary} />
          <Text style={styles.chipText}>{t("water_demand")}: {t(crop.water_demand as any)}</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: RISK_COLOR[crop.groundwater_risk], borderColor: RISK_COLOR[crop.groundwater_risk] }]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={14} color="#000" />
          <Text style={[styles.chipText, { color: "#000" }]}>{t("groundwater_risk")}: {t(crop.groundwater_risk as any)}</Text>
        </View>
      </View>

      <Text style={styles.whyTitle}>{t("why_this_crop")}</Text>
      {reasons.length > 0 ? reasons.map((r, i) => (
        <View key={i} style={styles.reasonRow}>
          <MaterialCommunityIcons name="check-circle" size={14} color={colors.success} />
          <Text style={styles.reasonText}>{t(("reason_" + r) as any)}</Text>
        </View>
      )) : (
        <Text style={styles.reasonText}>{t("reason_balanced_overall_score")}</Text>
      )}

      <Pressable
        onPress={() => (state === "playing" ? stop() : speak(speakText, lang))}
        style={[styles.voiceBtn, state !== "idle" && { backgroundColor: colors.brandSecondary }]}
        testID={`voice-btn-${crop.crop}`}
      >
        <MaterialCommunityIcons
          name={state === "loading" ? "loading" : state === "playing" ? "stop-circle" : "volume-high"}
          size={20}
          color={colors.onBrandPrimary}
        />
        <Text style={styles.voiceText}>{state === "playing" ? t("stop") : t("voice_read")}</Text>
      </Pressable>
    </View>
  );
}

export default function CropsScreen() {
  const insets = useSafeAreaInsets();
  const { t, cropName, lang } = useI18n();
  const s = useAppStore();
  const queue = useVoiceRead();

  if (s.loading || !s.recommendation) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brandPrimary} size="large" />
        <Text style={styles.loadingText}>{t("loading_recommendation")}</Text>
      </View>
    );
  }

  const buildCropText = (c: Crop) => {
    const reasonText = (c.reasons ?? []).map((r) => t(("reason_" + r) as any)).join(" ");
    return `${c.rank}. ${cropName(c.crop)}. ${t("suitability_score")} ${c.score_with_groundwater}. `
      + `${t("water_demand")}: ${t(c.water_demand as any)}. ${t("groundwater_risk")}: ${t(c.groundwater_risk as any)}. `
      + reasonText;
  };

  const onReadAll = () => {
    if (queue.state !== "idle") { queue.stop(); return; }
    const items = s.recommendation!.top5_with_groundwater.map(buildCropText);
    queue.speakQueue(items, lang);
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 24, paddingHorizontal: 16 }}
      testID="crops-screen"
    >
      <Text style={styles.header}>{t("recommended_crops")}</Text>
      <Text style={styles.sub}>{s.location?.district}, {s.location?.state}</Text>

      <Pressable
        onPress={onReadAll}
        style={[
          styles.readAllBtn,
          queue.state === "playing" && { backgroundColor: colors.brandSecondary },
          queue.state === "error" && { backgroundColor: colors.error },
        ]}
        testID="voice-read-all-crops-button"
      >
        <MaterialCommunityIcons
          name={
            queue.state === "loading" ? "loading"
              : queue.state === "playing" ? "stop-circle"
              : queue.state === "error" ? "alert-circle-outline"
              : "playlist-music"
          }
          size={22}
          color={colors.onBrandPrimary}
        />
        <Text style={styles.readAllText}>
          {queue.state === "playing" && queue.queuePos
            ? `${t("reading")} ${queue.queuePos.i}/${queue.queuePos.n}`
            : queue.state === "playing" ? t("stop")
            : queue.state === "loading" ? "…"
            : queue.state === "error" ? "Tap again"
            : t("voice_read_all_crops")}
        </Text>
      </Pressable>

      {s.recommendation.top5_with_groundwater.map((c) => (
        <CropCard key={c.crop} crop={c} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, gap: 12 },
  loadingText: { color: colors.muted, fontSize: 14 },
  header: { color: colors.onSurface, fontSize: 24, fontWeight: "800" },
  sub: { color: colors.muted, fontSize: 13, marginBottom: 12 },
  readAllBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.brandPrimary, paddingVertical: 12, borderRadius: 999, marginBottom: 14 },
  readAllText: { color: colors.onBrandPrimary, fontSize: 14, fontWeight: "800" },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  medal: { fontSize: 28 },
  cropName: { color: colors.onSurface, fontSize: 20, fontWeight: "800" },
  scoreRow: { flexDirection: "row", alignItems: "baseline", marginTop: 2, gap: 4 },
  scoreNum: { color: colors.brandSecondary, fontSize: 28, fontWeight: "900" },
  scoreDen: { color: colors.muted, fontSize: 14 },
  scoreLabel: { color: colors.muted, fontSize: 12, marginLeft: 6 },
  chips: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  chipText: { color: colors.onSurfaceSecondary, fontSize: 11, fontWeight: "700" },
  confidence: { color: colors.muted, fontSize: 12, marginTop: 12 },
  progressTrack: { height: 6, backgroundColor: colors.surfaceTertiary, borderRadius: 3, marginTop: 4, overflow: "hidden" },
  progressFill: { height: 6, backgroundColor: colors.brandPrimary },
  confidencePct: { color: colors.onSurface, fontSize: 11, marginTop: 2, alignSelf: "flex-end" },
  whyTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "700", marginTop: 12, marginBottom: 6 },
  reasonRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 3 },
  reasonText: { color: colors.onSurfaceSecondary, fontSize: 13, flex: 1 },
  voiceBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.brandPrimary, paddingVertical: 12, borderRadius: 999, marginTop: 14 },
  voiceText: { color: colors.onBrandPrimary, fontSize: 14, fontWeight: "700" },
});
