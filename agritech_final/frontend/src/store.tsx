// Central data store — one location detect + one recommendation fetch, shared
// across tabs.
//
// Features layered on top of the base pipeline:
//   • The user's real GPS location is ALWAYS shown.
//   • If the district is outside our Telangana dataset, we call the backend
//     `/api/nearest-reference` and pull NPK/groundwater for that nearest
//     reference district so the recommendation is meaningful (not just state
//     mean). The UI displays both the real location and the reference match.
//   • Save-my-farm: coords + display name persisted in AsyncStorage. If a
//     saved farm exists, refresh() skips the GPS prompt and uses those coords.
//   • Judge Demo Mode: cycles through 3 preset districts so live audiences
//     see the recommendation change instantly.
import React, {
  createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ExpoLocation from "expo-location";
import { api, Groundwater, Location as GeoLoc, NPK, RecommendResult, Weather } from "./api";

const FARM_KEY = "aquacrop.farm.v1";

type SavedFarm = { coords: { lat: number; lon: number }; location: GeoLoc } | null;
type NearestRef = { state: string; district: string; distance_km: number } | null;

export type DemoPreset = {
  key: string;
  label: string;
  coords: { lat: number; lon: number };
  location: GeoLoc;
};

export const DEMO_PRESETS: DemoPreset[] = [
  {
    key: "adilabad", label: "Adilabad — moderate",
    coords: { lat: 19.6667, lon: 78.5333 },
    location: { state: "Telangana", district: "Adilabad", area: "Adilabad",
      display_name: "Adilabad, Telangana, India", source: "Demo" },
  },
  {
    key: "khammam", label: "Khammam — high depletion",
    coords: { lat: 17.2473, lon: 80.15 },
    location: { state: "Telangana", district: "KHAMMAM", area: "Khammam",
      display_name: "Khammam, Telangana, India", source: "Demo" },
  },
  {
    key: "mahbubnagar", label: "Mahbubnagar — mild",
    coords: { lat: 16.7375, lon: 77.9974 },
    location: { state: "Telangana", district: "MAHBUBNAGAR", area: "Mahbubnagar",
      display_name: "Mahbubnagar, Telangana, India", source: "Demo" },
  },
];

// Fallback used only when GPS + reverse-geocode both fail.
const NO_GPS_LOCATION: GeoLoc = {
  state: "Telangana", district: "Adilabad", area: "Adilabad",
  display_name: "Adilabad, Telangana, India", source: "No GPS",
};
const NO_GPS_COORDS = { lat: 19.6667, lon: 78.5333 };

type State = {
  loading: boolean;
  error: string | null;
  location: GeoLoc | null;
  weather: Weather | null;
  npk: NPK | null;
  groundwater: Groundwater | null;
  recommendation: RecommendResult | null;
  dataFallback: boolean;
  nearestReference: NearestRef;
  savedFarm: SavedFarm;
  demoPreset: DemoPreset | null;
  centroids: { state: string; bbox: any; districts: { district: string; lat: number; lon: number }[] } | null;
};

type Ctx = State & {
  refresh: () => Promise<void>;
  pinFarm: () => Promise<void>;
  unpinFarm: () => Promise<void>;
  cycleDemo: () => Promise<void>;
  exitDemo: () => Promise<void>;
};

const AppCtx = createContext<Ctx | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({
    loading: false, error: null,
    location: null, weather: null, npk: null, groundwater: null, recommendation: null,
    dataFallback: false, nearestReference: null, savedFarm: null, demoPreset: null,
    centroids: null,
  });

  // Fetch Telangana district centroids once for the map preview.
  useEffect(() => {
    api.centroids().then((c) => setState((s) => ({ ...s, centroids: c }))).catch(() => {});
  }, []);

  const runPipeline = useCallback(async (opts: {
    coords: { lat: number; lon: number };
    preset?: DemoPreset | null;
    savedFarm?: SavedFarm;
    forceLocation?: GeoLoc | null;
  }) => {
    const { coords, preset = null, savedFarm = null, forceLocation = null } = opts;

    // 1. Location: demo/saved wins over reverse-geocode.
    let loc: GeoLoc;
    if (preset) {
      loc = { ...preset.location, lat: preset.coords.lat, lon: preset.coords.lon };
    } else if (forceLocation) {
      loc = { ...forceLocation, lat: forceLocation.lat ?? coords.lat, lon: forceLocation.lon ?? coords.lon };
    } else {
      try {
        loc = await api.reverse(coords.lat, coords.lon);
        if (!loc.lat) loc.lat = coords.lat;
        if (!loc.lon) loc.lon = coords.lon;
        if (!loc.state && !loc.district) throw new Error("empty admin data");
      } catch {
        loc = {
          state: "Unknown", district: "Unknown", area: "",
          lat: coords.lat, lon: coords.lon,
          display_name: `${coords.lat.toFixed(3)}, ${coords.lon.toFixed(3)}`,
          source: "GPS only",
        };
      }
    }

    // 2. Weather for those coords.
    let weather: Weather | null = null;
    try { weather = await api.weather(coords.lat, coords.lon); } catch { weather = null; }

    // 3. NPK — try the real district first.
    let dataFallback = false;
    let nearestReference: NearestRef = null;
    let npk: NPK | null = null;
    try {
      npk = await api.npk(loc.state, loc.district);
      if (npk.fallback) dataFallback = true;
    } catch {
      npk = null;
    }

    // If NPK failed OR only state-mean was returned, project onto the nearest
    // Telangana reference district (backend endpoint) and re-fetch.
    if (!npk || npk.fallback) {
      try {
        const near = await api.nearestReference(coords.lat, coords.lon);
        nearestReference = { state: near.state, district: near.district, distance_km: near.distance_km };
        try {
          const refNpk = await api.npk(near.state, near.district);
          npk = refNpk;
          dataFallback = true;
        } catch { /* keep existing npk */ }
      } catch { /* keep dataFallback = false */ }
    }

    // 4. Groundwater — same idea.
    let groundwater: Groundwater | null = null;
    try {
      groundwater = await api.groundwater(loc.state, loc.district);
      if (groundwater.fallback) dataFallback = true;
    } catch { groundwater = null; }

    if ((!groundwater || groundwater.fallback) && nearestReference) {
      try {
        const refGw = await api.groundwater(nearestReference.state, nearestReference.district);
        groundwater = refGw;
        dataFallback = true;
      } catch { /* keep existing */ }
    }

    // 5. Recommendation.
    let recommendation: RecommendResult | null = null;
    if (npk && weather && groundwater) {
      recommendation = await api.recommend({
        state: loc.state, district: loc.district, area: loc.area,
        npk, weather, groundwater,
      });
    }

    setState((prev) => ({
      ...prev,
      loading: false, error: null,
      location: loc, weather, npk, groundwater, recommendation,
      dataFallback, nearestReference,
      savedFarm, demoPreset: preset,
    }));
  }, []);

  // --- entry points ----------------------------------------------------------

  const detectAndRun = useCallback(async (savedFarm: SavedFarm, preset: DemoPreset | null) => {
    setState((s) => ({ ...s, loading: true, error: null, savedFarm, demoPreset: preset }));

    if (preset) {
      await runPipeline({ coords: preset.coords, preset, savedFarm });
      return;
    }
    if (savedFarm) {
      await runPipeline({
        coords: savedFarm.coords, savedFarm,
        forceLocation: savedFarm.location,
      });
      return;
    }

    let coords = NO_GPS_COORDS;
    let gotGps = false;
    const perm = await ExpoLocation.requestForegroundPermissionsAsync();
    if (perm.status === "granted") {
      try {
        const pos = await ExpoLocation.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy.Balanced,
        });
        coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        gotGps = true;
      } catch { /* fall through */ }
    }

    if (!gotGps) {
      await runPipeline({
        coords: NO_GPS_COORDS, savedFarm,
        forceLocation: NO_GPS_LOCATION,
      });
      return;
    }
    await runPipeline({ coords, savedFarm });
  }, [runPipeline]);

  const refresh = useCallback(async () => {
    const raw = await AsyncStorage.getItem(FARM_KEY);
    const savedFarm: SavedFarm = raw ? (JSON.parse(raw) as SavedFarm) : null;
    await detectAndRun(savedFarm, state.demoPreset);
  }, [detectAndRun, state.demoPreset]);

  const pinFarm = useCallback(async () => {
    if (!state.location) return;
    // Prefer real GPS coords; fall back to no-gps coords if we didn't get any.
    let coords = NO_GPS_COORDS;
    const perm = await ExpoLocation.getForegroundPermissionsAsync();
    if (perm.status === "granted") {
      try {
        const pos = await ExpoLocation.getCurrentPositionAsync({
          accuracy: ExpoLocation.Accuracy.Balanced,
        });
        coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      } catch { /* ignore */ }
    }
    const saved: SavedFarm = { coords, location: state.location };
    await AsyncStorage.setItem(FARM_KEY, JSON.stringify(saved));
    setState((s) => ({ ...s, savedFarm: saved }));
  }, [state.location]);

  const unpinFarm = useCallback(async () => {
    await AsyncStorage.removeItem(FARM_KEY);
    setState((s) => ({ ...s, savedFarm: null }));
  }, []);

  const cycleDemo = useCallback(async () => {
    const idx = state.demoPreset
      ? (DEMO_PRESETS.findIndex((p) => p.key === state.demoPreset!.key) + 1) % DEMO_PRESETS.length
      : 0;
    const next = DEMO_PRESETS[idx];
    await detectAndRun(state.savedFarm, next);
  }, [state.demoPreset, state.savedFarm, detectAndRun]);

  const exitDemo = useCallback(async () => {
    await detectAndRun(state.savedFarm, null);
  }, [state.savedFarm, detectAndRun]);

  // Initial load: read saved farm, then run.
  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(FARM_KEY);
      const savedFarm: SavedFarm = raw ? (JSON.parse(raw) as SavedFarm) : null;
      await detectAndRun(savedFarm, null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<Ctx>(() => ({
    ...state, refresh, pinFarm, unpinFarm, cycleDemo, exitDemo,
  }), [state, refresh, pinFarm, unpinFarm, cycleDemo, exitDemo]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useAppStore(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useAppStore outside provider");
  return c;
}
