# AquaCrop AI — Product Requirements

## Purpose
A mobile-first, multilingual crop advisory for Indian farmers that combines **GPS + Live Weather + Soil NPK + Historical Groundwater + Random Forest + XGBoost** to recommend the most sustainable crops for the user's actual location, with a "With vs Without Groundwater" comparison so hackathon judges (Specathon 2026) can see the innovation clearly.

## Datasets (real, uploaded)
- `final_npk.csv` — district-level Soil NPK (Telangana).
- `GWL_Cleaned.csv` — historical groundwater levels 2021-2023 (Telangana, 34 districts).
- `crop_scores.csv` — crop suitability scores for 22 crops on N/P/K/temp/humidity/pH/rainfall.

## Key features
- **First-launch language selection** (English / తెలుగు / हिंदी) persisted with AsyncStorage.
- **Farmer dashboard**: location (GPS reverse-geocoded), live weather (Open-Meteo), soil NPK, groundwater status with mbgl level, top crop card, quick comparison.
- **Recommendations tab**: top-5 crops with rank medal, suitability score /100, water demand & groundwater risk chips, ML confidence bar, "Why this crop" reasons, and a **Voice Read** button (Emergent OpenAI TTS).
- **Compare tab**: line chart of yearly groundwater (2021→2023), grouped-bar chart of With-vs-Without-Groundwater scores, rank-change list, textual explanation.
- **Settings**: change language, voice toggle, methodology screen with ML metrics (RF/XGB CV-MAE, R²) and feature-importance bars.
- **Farmer Invoice / PDF** — REMOVED per user request.

## Location behaviour
- Shows the user's real GPS state/district/area (Nominatim OSM) with **full breakdown**: place/area, subdistrict, district, state, country, postal code, and exact GPS coordinates (lat/lon).
- **Re-detect GPS** button and **Pin this farm** button in the location card header.
- If the user is outside Telangana (our only-Telangana dataset), the app still shows their real location, but silently loads the **nearest Telangana reference district** (via `/api/nearest-reference`) for NPK / groundwater and shows a small "Nearest reference: <district> · ~<km> km" note.
- Graceful fallbacks: Nominatim rate-limit → Telangana centroid (only if coords are inside Telangana bbox) → GPS coordinates label everywhere else.

## Machine learning
- Random Forest and XGBoost regressors trained on `crop_scores.csv` with 5-fold CV.
- Models saved to `/app/backend/models/*.joblib` and reloaded on startup (no retrain per request).
- Ensemble = 0.4 × RF + 0.6 × XGB.
- Final score = 0.35 × Suitability + 0.35 × ML ensemble + 0.30 × Groundwater sustainability (WITH-GW ranking). Sustainability term is dropped in the WITHOUT-GW ranking so judges see the delta.

## Tech
- Backend: FastAPI + pandas + scikit-learn + xgboost + joblib + emergentintegrations (TTS).
- Frontend: Expo Router 57, react-native-safe-area-context, react-native-svg (charts), expo-location, expo-audio, MaterialCommunityIcons.
- Theme: dark-first earthy palette from `design_guidelines.json`, all colors via `src/theme.ts`.

## Status
- Backend endpoints tested (10/11 pass; Nominatim now falls back gracefully).
- Frontend flows verified via testing agent (Home, Crops, Compare, Settings, Methodology, TTS playback).
- Language switch verified: instantly translates entire UI.
