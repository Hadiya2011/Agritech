"""FastAPI backend for AquaCrop AI.

Endpoints (prefixed /api):
    GET  /api/                     - health check
    GET  /api/location/reverse     - GPS → state / district / area
    GET  /api/weather              - live weather via Open-Meteo
    GET  /api/npk                  - district NPK
    GET  /api/groundwater          - groundwater trend + yearly series
    POST /api/recommend            - top-5 crops (with + without groundwater)
    POST /api/tts                  - synthesise speech, returns audio key
    GET  /api/tts/{key}.mp3        - stream the audio bytes
    GET  /api/meta                 - model metadata / feature importance
    GET  /api/known-locations      - list of states/districts we have data for
"""
from __future__ import annotations
import os
import math
import asyncio
import logging
from pathlib import Path
from typing import Optional
from datetime import datetime, timezone

import httpx
from fastapi import FastAPI, APIRouter, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from data_service import get_store
from recommendation import RecommendationEngine, humidity_label, rainfall_label
from tts_service import TTSService

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(levelname)s %(name)s :: %(message)s")
log = logging.getLogger("aquacrop")

# Approx centroids for every Telangana district we have data for. Used as a
# last-resort fallback when the reverse-geocode provider is rate-limiting or
# unreachable so the app is never dead-ended.
TELANGANA_CENTROIDS: list[tuple[str, float, float]] = [
    ("ADILABAD", 19.6667, 78.5333), ("BHADRADRI", 17.6, 80.6),
    ("HANAMKONDA", 18.0, 79.5667), ("HYDERABAD", 17.385, 78.4867),
    ("JAGITYAL", 18.7833, 78.9167), ("JANGAON", 17.7167, 79.15),
    ("JAYASHANKAR BHUPALAPALLY", 18.25, 79.9), ("JOGULAMBA(GADWAL)", 16.2333, 77.8),
    ("KAMAREDDY", 18.32, 78.34), ("KARIMNAGAR", 18.4386, 79.1288),
    ("KHAMMAM", 17.2473, 80.15), ("KUMURAM BHEEM", 19.35, 79.05),
    ("MAHABUBABAD", 17.6, 80.0), ("MAHBUBNAGAR", 16.7375, 77.9974),
    ("MANCHERIAL", 18.87, 79.44), ("MEDAK", 18.05, 78.27),
    ("MEDCHAL", 17.63, 78.48), ("MULUGU", 18.19, 80.02),
    ("NAGARKURNOOL", 16.48, 78.32), ("NALGONDA", 17.05, 79.27),
    ("NARAYANPET", 16.75, 77.5), ("NIRMAL", 19.1, 78.35),
    ("NIZAMABAD", 18.6725, 78.0941), ("PEDDAPALLY", 18.62, 79.37),
    ("RAJANNA SIRCILLA", 18.39, 78.81), ("RANGA REDDY", 17.4, 78.35),
    ("SANGA REDDY", 17.62, 78.08), ("SIDDIPET", 18.1, 78.85),
    ("SURYAPET", 17.14, 79.62), ("VIKARABAD", 17.34, 77.91),
    ("WANAPARTHY", 16.36, 78.06), ("WARANGAL RURAL", 17.98, 79.6),
    ("WARANGAL URBAN", 17.98, 79.6), ("YADADRI", 17.6, 78.95),
]


def _nearest_centroid(lat: float, lon: float) -> tuple[str, str]:
    best = min(
        TELANGANA_CENTROIDS,
        key=lambda x: (x[1] - lat) ** 2 + (x[2] - lon) ** 2,
    )
    return "Telangana", best[0]


app = FastAPI(title="AquaCrop AI")
api = APIRouter(prefix="/api")

# Eager-load data + models so first user request is fast and errors surface early.
STORE = get_store()
ENGINE = RecommendationEngine()
TTS = TTSService()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class RecommendPayload(BaseModel):
    state: str
    district: str
    area: Optional[str] = None
    npk: dict
    weather: dict
    groundwater: Optional[dict] = None


class TTSPayload(BaseModel):
    text: str
    voice: Optional[str] = "nova"
    speed: Optional[float] = 1.0
    model: Optional[str] = "tts-1-hd"


# ---------------------------------------------------------------------------
# Health & meta
# ---------------------------------------------------------------------------

@api.get("/")
async def root():
    return {"service": "AquaCrop AI", "status": "ok", "time": datetime.now(timezone.utc).isoformat()}


@api.get("/meta")
async def meta():
    return {
        "ml": ENGINE.ml.meta,
        "known_states": STORE.known_states(),
        "years_available": sorted(STORE.gwl["Year"].unique().tolist()),
        "crops": STORE.crop_table()["crop"].tolist(),
    }


@api.get("/known-locations")
async def known_locations():
    return {
        s: STORE.known_districts(s) for s in STORE.known_states()
    }


@api.get("/nearest-reference")
async def nearest_reference(lat: float, lon: float):
    """Return the nearest Telangana district (used for dataset fallback so
    farmers outside our coverage still see a meaningful reference)."""
    best = min(TELANGANA_CENTROIDS, key=lambda x: (x[1] - lat) ** 2 + (x[2] - lon) ** 2)
    _, blat, blon = best
    dlat = math.radians(blat - lat)
    dlon = math.radians(blon - lat)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat)) * math.cos(math.radians(blat))
         * math.sin(math.radians(blon - lon) / 2) ** 2)
    km = 6371 * 2 * math.asin(math.sqrt(a))
    return {"state": "Telangana", "district": best[0],
            "distance_km": round(km, 1),
            "lat": blat, "lon": blon}


# ---------------------------------------------------------------------------
# Reverse geocode (OpenStreetMap Nominatim - free, no key required)
# ---------------------------------------------------------------------------

@api.get("/location/reverse")
async def reverse_geocode(lat: float, lon: float):
    url = "https://nominatim.openstreetmap.org/reverse"
    params = {"lat": lat, "lon": lon, "format": "jsonv2", "zoom": 10, "addressdetails": 1}
    headers = {"User-Agent": "AquaCrop-AI/1.0 (specathon 2026)"}

    async def _try_once() -> dict | None:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                r = await client.get(url, params=params, headers=headers)
                if r.status_code == 200:
                    return r.json()
        except Exception as e:
            log.info("reverse geocode attempt failed: %s", e)
        return None

    data = await _try_once()
    if data is None:
        await asyncio.sleep(0.6)
        data = await _try_once()

    if data is None:
        # Fallback: only project onto Telangana centroids when coords are
        # roughly inside/near Telangana. Elsewhere, return an Unknown label so
        # the client can show the raw coordinates instead of a wrong district.
        if 15.5 <= lat <= 20.2 and 77.0 <= lon <= 81.5:
            state, district = _nearest_centroid(lat, lon)
            return {
                "state": state, "district": district, "area": district.title(),
                "subdistrict": "", "country": "India", "postcode": "",
                "lat": lat, "lon": lon,
                "display_name": f"{district.title()}, {state}, India",
                "source": "AquaCrop centroid fallback",
            }
        return {
            "state": "Unknown", "district": "Unknown", "area": "",
            "subdistrict": "", "country": "", "postcode": "",
            "lat": lat, "lon": lon,
            "display_name": f"{lat:.3f}, {lon:.3f}",
            "source": "GPS only (geocoder unavailable)",
        }

    addr = data.get("address", {})
    state = addr.get("state") or addr.get("region") or ""
    district = (addr.get("state_district") or addr.get("county")
                or addr.get("district") or addr.get("city_district") or "")
    district = district.replace(" district", "").replace(" District", "").strip()
    area = (addr.get("village") or addr.get("town") or addr.get("suburb")
            or addr.get("city") or addr.get("hamlet") or "")
    subdistrict = addr.get("suburb") or addr.get("neighbourhood") or addr.get("hamlet") or ""
    country = addr.get("country") or ""
    postcode = addr.get("postcode") or ""

    return {
        "state": state,
        "district": district,
        "area": area,
        "subdistrict": subdistrict,
        "country": country,
        "postcode": postcode,
        "lat": lat,
        "lon": lon,
        "display_name": data.get("display_name", ""),
        "source": "OpenStreetMap Nominatim",
    }


# ---------------------------------------------------------------------------
# Live weather (Open-Meteo - free, no key)
# ---------------------------------------------------------------------------

@api.get("/weather")
async def weather(lat: float, lon: float):
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": lat, "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,precipitation",
        "past_days": 7,
        "daily": "precipitation_sum",
        "timezone": "auto",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        log.warning("weather fetch failed: %s", e)
        raise HTTPException(502, "Weather service unavailable")

    cur = data.get("current", {})
    d = data.get("daily", {}) or {}
    daily_sum = d.get("precipitation_sum") or []
    daily_time = d.get("time") or []
    today_iso = (cur.get("time") or "")[:10]

    past: list[dict] = []
    future: list[dict] = []
    for t, v in zip(daily_time, daily_sum):
        entry = {"date": t, "mm": round(float(v or 0), 1)}
        if t and today_iso and t < today_iso:
            past.append(entry)
        else:
            future.append(entry)
    daily_rainfall = past[-7:]      # last 7 completed days
    forecast_rainfall = future[:7]  # today + next 6 days
    weekly_rain = sum(x["mm"] for x in daily_rainfall) if daily_rainfall else 0.0

    temp = float(cur.get("temperature_2m") or 0)
    hum = float(cur.get("relative_humidity_2m") or 0)

    return {
        "temperature_c": round(temp, 1),
        "humidity_pct": round(hum, 1),
        "rainfall_mm": round(weekly_rain, 1),
        "humidity_category": humidity_label(hum),
        "rainfall_category": rainfall_label(weekly_rain),
        "daily_rainfall": daily_rainfall,
        "forecast_rainfall": forecast_rainfall,
        "timestamp": cur.get("time"),
        "source": "Open-Meteo",
    }


@api.get("/telangana-centroids")
async def telangana_centroids():
    return {
        "state": "Telangana",
        "bbox": {"lat_min": 15.8, "lat_max": 20.2, "lon_min": 77.0, "lon_max": 81.8},
        "districts": [
            {"district": name, "lat": lat, "lon": lon}
            for name, lat, lon in TELANGANA_CENTROIDS
        ],
    }


# ---------------------------------------------------------------------------
# NPK + groundwater
# ---------------------------------------------------------------------------

@api.get("/npk")
async def npk_lookup(state: str, district: str):
    data = STORE.npk_for(state, district)
    if data is None:
        raise HTTPException(404, "Soil NPK not found for this location")
    return data


@api.get("/groundwater")
async def groundwater_lookup(state: str, district: str):
    data = STORE.groundwater_for(state, district)
    if data is None:
        raise HTTPException(404, "Groundwater data not found for this location")
    return data


# ---------------------------------------------------------------------------
# Recommendation
# ---------------------------------------------------------------------------

@api.post("/recommend")
async def recommend(payload: RecommendPayload):
    return ENGINE.recommend(
        npk=payload.npk, weather=payload.weather, groundwater=payload.groundwater
    )


# ---------------------------------------------------------------------------
# Text-to-speech
# ---------------------------------------------------------------------------

@api.post("/tts")
async def tts(payload: TTSPayload):
    try:
        key = await TTS.synthesize(
            payload.text,
            voice=payload.voice or "nova",
            speed=payload.speed or 1.0,
            model=payload.model or "tts-1-hd",
        )
    except Exception as e:
        log.warning("tts failed: %s", e)
        raise HTTPException(502, f"TTS failed: {e}")
    return {"key": key, "url": f"/api/tts/{key}.mp3"}


@api.get("/tts/{key}.mp3")
async def tts_audio(key: str):
    path = TTS.audio_path(key)
    if not path.exists():
        raise HTTPException(404, "audio not found")
    return Response(content=path.read_bytes(), media_type="audio/mpeg",
                    headers={"Cache-Control": "public, max-age=31536000"})


# ---------------------------------------------------------------------------
# Wire-up
# ---------------------------------------------------------------------------

app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
