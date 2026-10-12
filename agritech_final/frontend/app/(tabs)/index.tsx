import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import MaterialCommunityIcons from "@react-native-vector-icons/material-design-icons";
import { colors } from "@/src/theme";
import { useI18n } from "@/src/i18n";
import { useAppStore } from "@/src/store";
import { MapPreview, RainfallStrip } from "@/src/charts";
import { useVoiceRead } from "@/src/voice";

function StatusColor(status?: string) {
  if (status === "depleting") return colors.error;
  if (status === "improving") return colors.success;
  return colors.warning;
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const { t, cropName, lang } = useI18n();
  const router = useRouter();
  const s = useAppStore();
  const voice = useVoiceRead();

  if (s.loading || !s.recommendation) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]} testID="home-loading">
        <ActivityIndicator size="large" color={colors.brandPrimary} />
        <Text style={styles.loadingText}>{t("loading_recommendation")}</Text>
      </View>
    );
  }

  const top = s.recommendation.top5_with_groundwater[0];
  const gwColor = StatusColor(s.groundwater?.status);
  const statusText = t((s.groundwater?.status ?? "stable") as any);

  const speakAll = () => {
    if (voice.state !== "idle") { voice.stop(); return; }
    const parts = [
      `${t("location")}: ${s.location?.district}, ${s.location?.state}.`,
      `${t("temperature")}: ${s.weather?.temperature_c} degrees. ${t("humidity")}: ${t((s.weather?.humidity_category?.toLowerCase() ?? "moderate") as any)}. ${t("rainfall")}: ${t((s.weather?.rainfall_category?.toLowerCase() ?? "low") as any)}.`,
      `${t("soil")}. ${t("nitrogen")} ${s.npk?.N.toFixed(2)}, ${t("phosphorus")} ${s.npk?.P.toFixed(2)}, ${t("potassium")} ${s.npk?.K.toFixed(2)}.`,
      `${t("groundwater")}: ${statusText}, ${s.groundwater?.current_mbgl} ${t("mbgl")}.`,
      `${t("top_crop")}: ${cropName(top.crop)}, ${t("suitability_score")} ${top.score_with_groundwater} / 100.`,
    ];
    voice.speak(parts.join(" "), lang);
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 24, paddingHorizontal: 16 }}
      testID="home-screen"
    >
      {/* Brand title. Long-press to cycle judge demo mode. */}
      <Pressable onLongPress={s.cycleDemo} delayLongPress={550} testID="brand-longpress">
        <Text style={styles.brand}>AquaCrop AI</Text>
        <Text style={styles.tagline}>{t("tagline")}</Text>
      </Pressable>

      {s.demoPreset ? (
        <View style={styles.demoBar} testID="demo-bar">
          <MaterialCommunityIcons name="flask-outline" size={14} color={colors.onBrandTertiary} />
          <Text style={styles.demoText}>{t("demo_mode")}: {s.demoPreset.label}</Text>
          <Pressable onPress={s.exitDemo} testID="demo-exit">
            <MaterialCommunityIcons name="close-circle" size={16} color={colors.onBrandTertiary} />
          </Pressable>
        </View>
      ) : null}

      {/* Location + weather hero */}
      <View style={styles.hero} testID="home-hero">
        <View style={styles.heroRow}>
          <MaterialCommunityIcons name="map-marker" size={22} color={colors.brandSecondary} />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.heroTitle}>{s.location?.area || s.location?.district}</Text>
            <Text style={styles.heroSub}>
              {[s.location?.subdistrict, s.location?.district, s.location?.state, s.location?.country]
                .filter((x) => x && x !== s.location?.area).join(" · ")}
            </Text>
            {s.location?.lat && s.location?.lon ? (
              <Text style={styles.heroCoords}>
                <MaterialCommunityIcons name="crosshairs-gps" size={10} color={colors.muted} />{" "}
                {s.location.lat.toFixed(4)}, {s.location.lon.toFixed(4)}
                {s.location.postcode ? ` · ${s.location.postcode}` : ""}
              </Text>
            ) : null}
          </View>
          <View style={styles.pinCol}>
            <Pressable
              onPress={s.savedFarm ? s.unpinFarm : s.pinFarm}
              style={styles.pinBtn}
              testID={s.savedFarm ? "unpin-farm-button" : "pin-farm-button"}
            >
              <MaterialCommunityIcons
                name={s.savedFarm ? "pin" : "pin-outline"}
                size={18}
                color={s.savedFarm ? colors.brandPrimary : colors.muted}
              />
            </Pressable>
            <Pressable onPress={s.refresh} style={[styles.pinBtn, { marginTop: 4 }]} testID="redetect-button">
              <MaterialCommunityIcons name="crosshairs-gps" size={18} color={colors.muted} />
            </Pressable>
          </View>
        </View>

        {s.savedFarm ? (
          <View style={styles.savedRow} testID="saved-farm-note">
            <MaterialCommunityIcons name="content-save-check-outline" size={12} color={colors.success} />
            <Text style={styles.savedText}>{t("farm_pinned")}</Text>
          </View>
        ) : null}

        {s.dataFallback ? (
          <View style={styles.refNote} testID="reference-note">
            <MaterialCommunityIcons name="information-outline" size={14} color={colors.brandSecondary} />
            <Text style={styles.refNoteText}>
              {s.nearestReference
                ? `${t("nearest_reference")}: ${s.nearestReference.district.toString().replace(/(^|\s)\S/g, (c) => c.toUpperCase())}, ${s.nearestReference.state} · ~${s.nearestReference.distance_km} km`
                : t("reference_data_note")}
            </Text>
          </View>
        ) : null}

        <View style={styles.heroWeather}>
          <View style={styles.weatherCell}>
            <MaterialCommunityIcons name="thermometer" size={22} color={colors.brandSecondary} />
            <Text style={styles.weatherVal}>{s.weather?.temperature_c}°C</Text>
            <Text style={styles.weatherKey}>{t("temperature")}</Text>
          </View>
          <View style={styles.weatherCell}>
            <MaterialCommunityIcons name="water-percent" size={22} color={colors.brandSecondary} />
            <Text style={styles.weatherVal}>{t((s.weather?.humidity_category?.toLowerCase() ?? "moderate") as any)}</Text>
            <Text style={styles.weatherKey}>{t("humidity")}</Text>
          </View>
          <View style={styles.weatherCell}>
            <MaterialCommunityIcons name="weather-pouring" size={22} color={colors.brandSecondary} />
            <Text style={styles.weatherVal}>{t((s.weather?.rainfall_category?.toLowerCase() ?? "low") as any)}</Text>
            <Text style={styles.weatherKey}>{t("rainfall")}</Text>
          </View>
        </View>

        {/* 7-day rainfall timelines: past + forecast, shared scale */}
        {s.weather?.daily_rainfall && s.weather.daily_rainfall.length > 0 ? (
          <View style={styles.rainWrap} testID="rainfall-strip">
            <Text style={styles.rainTitle}>{t("rainfall_7day")}</Text>
            <RainfallStrip
              items={s.weather.daily_rainfall}
              maxMm={Math.max(
                ...s.weather.daily_rainfall.map((x) => x.mm),
                ...(s.weather.forecast_rainfall ?? []).map((x) => x.mm),
                1,
              )}
            />
          </View>
        ) : null}
        {s.weather?.forecast_rainfall && s.weather.forecast_rainfall.length > 0 ? (
          <View style={styles.rainWrap} testID="forecast-strip">
            <Text style={styles.rainTitle}>{t("rain_forecast")}</Text>
            <RainfallStrip
              items={s.weather.forecast_rainfall}
              maxMm={Math.max(
                ...(s.weather.daily_rainfall ?? []).map((x) => x.mm),
                ...s.weather.forecast_rainfall.map((x) => x.mm),
                1,
              )}
            />
          </View>
        ) : null}
      </View>

      {/* NPK + Groundwater grid */}
      <View style={styles.grid}>
        <View style={[styles.gridCard, { marginRight: 6 }]} testID="npk-card">
          <View style={styles.cardHead}>
            <MaterialCommunityIcons name="grass" size={18} color={colors.brandSecondary} />
            <Text style={styles.cardTitle}>{t("soil")}</Text>
          </View>
          <Text style={styles.npkLine}>N: <Text style={styles.npkVal}>{s.npk?.N.toFixed(2)}</Text></Text>
          <Text style={styles.npkLine}>P: <Text style={styles.npkVal}>{s.npk?.P.toFixed(2)}</Text></Text>
          <Text style={styles.npkLine}>K: <Text style={styles.npkVal}>{s.npk?.K.toFixed(2)}</Text></Text>
        </View>
        <View style={[styles.gridCard, { marginLeft: 6 }]} testID="groundwater-card">
          <View style={styles.cardHead}>
            <MaterialCommunityIcons name="water" size={18} color={gwColor} />
            <Text style={styles.cardTitle}>{t("groundwater")}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: gwColor }]}>
            <Text style={styles.badgeText}>{statusText}</Text>
          </View>
          <Text style={styles.gwLevel}>{s.groundwater?.current_mbgl} <Text style={styles.gwUnit}>mbgl</Text></Text>
        </View>
      </View>

      {/* Top crop */}
      <View style={styles.topCropCard} testID="top-crop-card">
        <View style={styles.cardHead}>
          <MaterialCommunityIcons name="trophy" size={20} color={colors.brandSecondary} />
          <Text style={styles.cardTitle}>{t("top_crop")}</Text>
        </View>
        <Text style={styles.topCropName}>{cropName(top.crop)}</Text>
        <View style={styles.topScoreRow}>
          <Text style={styles.topScore}>{top.score_with_groundwater}</Text>
          <Text style={styles.topScoreSuffix}>/100</Text>
        </View>
        <Pressable style={styles.topCta} onPress={() => router.push("/(tabs)/crops")} testID="view-all-crops-button">
          <Text style={styles.topCtaText}>{t("view_all_crops")}</Text>
          <MaterialCommunityIcons name="arrow-right" size={18} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      {/* Voice Read Dashboard */}
      <Pressable
        onPress={speakAll}
        style={[
          styles.voiceAll,
          voice.state === "playing" && { backgroundColor: colors.brandSecondary },
          voice.state === "error" && { backgroundColor: colors.error },
        ]}
        testID="voice-read-all-button"
      >
        <MaterialCommunityIcons
          name={
            voice.state === "loading" ? "loading"
              : voice.state === "playing" ? "stop-circle"
              : voice.state === "error" ? "alert-circle-outline"
              : "volume-high"
          }
          size={24}
          color={colors.onBrandPrimary}
        />
        <Text style={styles.voiceAllText}>
          {voice.state === "loading" ? "…"
            : voice.state === "playing" ? t("stop")
            : voice.state === "error" ? "Tap again"
            : t("voice_read_all")}
        </Text>
      </Pressable>

      {/* Nearest district map preview */}
      {s.centroids && s.location?.lat && s.location?.lon ? (
        <View style={styles.card} testID="map-card">
          <Text style={styles.mapTitle}>{t("farm_and_reference")}</Text>
          <MapPreview
            bbox={s.centroids.bbox}
            districts={s.centroids.districts}
            farm={{ lat: s.location.lat, lon: s.location.lon, label: t("farm_label") }}
            reference={
              s.nearestReference && s.centroids.districts.find((d) => d.district === s.nearestReference!.district)
                ? {
                    district: s.nearestReference.district,
                    distance_km: s.nearestReference.distance_km,
                    lat: s.centroids.districts.find((d) => d.district === s.nearestReference!.district)!.lat,
                    lon: s.centroids.districts.find((d) => d.district === s.nearestReference!.district)!.lon,
                  }
                : null
            }
          />
          {s.nearestReference ? (
            <Text style={styles.mapNote}>
              {t("nearest_reference")}: {s.nearestReference.district} · ~{s.nearestReference.distance_km} km
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Quick action: comparison */}
      <Pressable
        style={styles.actionCardWide}
        onPress={() => router.push("/(tabs)/compare")}
        testID="quick-compare-button"
      >
        <MaterialCommunityIcons name="chart-bar" size={26} color={colors.brandSecondary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.actionText}>{t("view_comparison")}</Text>
          <Text style={styles.actionSub}>{t("compare_title")}</Text>
        </View>
        <MaterialCommunityIcons name="arrow-right" size={22} color={colors.muted} />
      </Pressable>

      <Text style={styles.hint}>{t("longpress_hint")}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface, gap: 12 },
  loadingText: { color: colors.muted, fontSize: 14 },
  brand: { color: colors.onSurface, fontSize: 22, fontWeight: "800" },
  tagline: { color: colors.muted, fontSize: 13, marginBottom: 12 },
  demoBar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.brandTertiary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginBottom: 12, borderWidth: 1, borderColor: colors.brandPrimary },
  demoText: { color: colors.onBrandTertiary, fontSize: 11, fontWeight: "700", flex: 1 },
  hero: { backgroundColor: colors.surfaceSecondary, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  heroRow: { flexDirection: "row", alignItems: "center" },
  heroTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "700" },
  heroSub: { color: colors.muted, fontSize: 12 },
  heroCoords: { color: colors.muted, fontSize: 10, marginTop: 4, fontFamily: "monospace" },
  pinCol: { alignItems: "center" },
  pinBtn: { width: 32, height: 32, borderRadius: 999, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  savedRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  savedText: { color: colors.success, fontSize: 11, fontWeight: "700" },
  refNote: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.surfaceTertiary, borderRadius: 8 },
  refNoteText: { color: colors.onSurfaceSecondary, fontSize: 11, flex: 1 },
  heroWeather: { flexDirection: "row", marginTop: 16, gap: 8 },
  weatherCell: { flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: 12, padding: 10, alignItems: "center" },
  weatherVal: { color: colors.onSurface, fontSize: 15, fontWeight: "700", marginTop: 4 },
  weatherKey: { color: colors.muted, fontSize: 10, marginTop: 2 },
  grid: { flexDirection: "row", marginBottom: 12 },
  gridCard: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.border },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  cardTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  npkLine: { color: colors.onSurfaceSecondary, fontSize: 13, marginTop: 2 },
  npkVal: { color: colors.onSurface, fontWeight: "700" },
  badge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: 2 },
  badgeText: { color: "#000", fontSize: 12, fontWeight: "700" },
  gwLevel: { color: colors.onSurface, fontSize: 22, fontWeight: "800", marginTop: 8 },
  gwUnit: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  topCropCard: { backgroundColor: colors.brandTertiary, borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: colors.brandPrimary },
  topCropName: { color: colors.onBrandTertiary, fontSize: 26, fontWeight: "800", marginTop: 4 },
  topScoreRow: { flexDirection: "row", alignItems: "baseline", marginTop: 6 },
  topScore: { color: colors.onSurface, fontSize: 40, fontWeight: "900" },
  topScoreSuffix: { color: colors.muted, fontSize: 16, marginLeft: 4 },
  topCta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.brandPrimary, marginTop: 12, paddingVertical: 12, borderRadius: 999 },
  topCtaText: { color: colors.onBrandPrimary, fontSize: 15, fontWeight: "700" },
  actionCardWide: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surfaceSecondary, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  actionText: { color: colors.onSurface, fontSize: 14, fontWeight: "700" },
  actionSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  rainWrap: { marginTop: 14 },
  rainTitle: { color: colors.muted, fontSize: 11, marginBottom: 6, fontWeight: "700", letterSpacing: 0.5 },
  voiceAll: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: colors.brandPrimary, paddingVertical: 14, borderRadius: 999, marginBottom: 12 },
  voiceAllText: { color: colors.onBrandPrimary, fontSize: 15, fontWeight: "800" },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: 20, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  mapTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "700", marginBottom: 6 },
  mapNote: { color: colors.brandSecondary, fontSize: 11, marginTop: 4, fontWeight: "600" },
  hint: { color: colors.muted, fontSize: 10, textAlign: "center", marginTop: 14 },
});
