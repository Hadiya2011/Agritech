import Constants from "expo-constants";
import { Platform } from "react-native";

// Backend client. Backend URL comes from EXPO_PUBLIC_BACKEND_URL or auto-detected LAN IP.
export function getBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, "");
  }
  // Auto-detect host IP when running in Expo Go on mobile
  const hostUri = Constants.expoConfig?.hostUri ?? (Constants as any)?.manifest?.debuggerHost;
  if (hostUri) {
    const host = hostUri.split(":")[0];
    if (host) return `http://${host}:8000`;
  }
  // Browser on laptop fallback
  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.hostname) {
    return `http://${window.location.hostname}:8000`;
  }
  return "http://localhost:8000";
}

export const BASE = getBaseUrl();

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getBaseUrl();
  const res = await fetch(`${base}${path}`, init);
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${t || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export type Location = {
  state: string; district: string; area: string;
  subdistrict?: string; country?: string; postcode?: string;
  lat?: number; lon?: number;
  display_name: string; source: string;
};
export type Weather = {
  temperature_c: number; humidity_pct: number; rainfall_mm: number;
  humidity_category: "Low" | "Moderate" | "High";
  rainfall_category: "Low" | "Moderate" | "High";
  daily_rainfall?: { date: string; mm: number }[];
  forecast_rainfall?: { date: string; mm: number }[];
  timestamp?: string; source: string;
};
export type NPK = { N: number; P: number; K: number; matched_state: string; matched_district: string; fallback: string | null };
export type Groundwater = {
  yearly: Record<string, number>; current_mbgl: number; slope: number; trend_pct: number;
  status: "depleting" | "stable" | "improving"; years_available: number; fallback: string | null;
};
export type Crop = {
  crop: string;
  suitability_score: number;
  rf_score: number; xgb_score: number; ml_ensemble_score: number;
  water_demand: "low" | "moderate" | "high";
  water_demand_score: number;
  groundwater_sustainability: number;
  groundwater_risk: "low" | "moderate" | "high";
  score_with_groundwater: number;
  score_without_groundwater: number;
  reasons?: string[];
  ml_confidence?: number;
  rank: number;
};
export type ComparisonRow = {
  crop: string; score_with: number; score_without: number;
  rank_with: number; rank_without: number; rank_change: number;
  water_demand: "low" | "moderate" | "high";
};
export type RecommendResult = {
  top5_with_groundwater: Crop[];
  top5_without_groundwater: Crop[];
  comparison: ComparisonRow[];
  summary: {
    status: string; top_with: string; top_without: string;
    biggest_drop_crop: string; biggest_drop_change: number;
    biggest_gain_crop: string; biggest_gain_change: number;
  };
  ml_meta: any;
  environment_categories: any;
};

export const api = {
  reverse: (lat: number, lon: number) =>
    req<Location>(`/api/location/reverse?lat=${lat}&lon=${lon}`),
  weather: (lat: number, lon: number) =>
    req<Weather>(`/api/weather?lat=${lat}&lon=${lon}`),
  npk: (state: string, district: string) =>
    req<NPK>(`/api/npk?state=${encodeURIComponent(state)}&district=${encodeURIComponent(district)}`),
  groundwater: (state: string, district: string) =>
    req<Groundwater>(`/api/groundwater?state=${encodeURIComponent(state)}&district=${encodeURIComponent(district)}`),
  nearestReference: (lat: number, lon: number) =>
    req<{ state: string; district: string; distance_km: number; lat: number; lon: number }>(
      `/api/nearest-reference?lat=${lat}&lon=${lon}`,
    ),
  centroids: () =>
    req<{ state: string; bbox: { lat_min: number; lat_max: number; lon_min: number; lon_max: number };
      districts: { district: string; lat: number; lon: number }[] }>(
      `/api/telangana-centroids`,
    ),
  recommend: (body: any) =>
    req<RecommendResult>(`/api/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  tts: (text: string, voice = "nova", speed = 1.0, model = "tts-1-hd") =>
    req<{ key: string; url: string }>(`/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice, speed, model }),
    }),
  ttsUrl: (key: string) => `${getBaseUrl()}/api/tts/${key}.mp3`,
  meta: () => req<any>(`/api/meta`),
};
