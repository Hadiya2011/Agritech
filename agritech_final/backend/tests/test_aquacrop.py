"""Backend tests for AquaCrop AI."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://groundwater-crops.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Health & meta ----------
def test_health(client):
    r = client.get(f"{BASE_URL}/api/", timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert body.get("service") == "AquaCrop AI"


def test_meta(client):
    r = client.get(f"{BASE_URL}/api/meta", timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert "ml" in body and "random_forest" in body["ml"]
    assert "feature_importance" in body["ml"]["random_forest"]
    assert body["known_states"] == ["Telangana"]
    years = body["years_available"]
    for y in (2021, 2022, 2023):
        assert y in years, f"missing year {y} in {years}"


def test_known_locations(client):
    r = client.get(f"{BASE_URL}/api/known-locations", timeout=30)
    assert r.status_code == 200
    body = r.json()
    assert "Telangana" in body
    assert isinstance(body["Telangana"], list)
    assert len(body["Telangana"]) > 0


# ---------- Location / weather ----------
def test_reverse_geocode(client):
    r = client.get(f"{BASE_URL}/api/location/reverse", params={"lat": 17.4, "lon": 78.5}, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("state", "").lower().startswith("telangana")
    assert "district" in body


def test_weather(client):
    r = client.get(f"{BASE_URL}/api/weather", params={"lat": 17.4, "lon": 78.5}, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    for k in ("temperature_c", "humidity_pct", "rainfall_mm",
              "humidity_category", "rainfall_category"):
        assert k in body
    assert body["humidity_category"] in {"Low", "Moderate", "High"}
    assert body["rainfall_category"] in {"Low", "Moderate", "High"}


# ---------- NPK ----------
def test_npk_adilabad(client):
    r = client.get(f"{BASE_URL}/api/npk", params={"state": "Telangana", "district": "Adilabad"}, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    for k in ("N", "P", "K"):
        assert isinstance(body[k], (int, float))
    assert body["fallback"] is None


def test_npk_fallback(client):
    r = client.get(f"{BASE_URL}/api/npk", params={"state": "Telangana", "district": "NOWHERE"}, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["matched_district"] == "STATE AVERAGE"
    assert body["fallback"] == "state_mean"


# ---------- Groundwater ----------
def test_groundwater(client):
    r = client.get(f"{BASE_URL}/api/groundwater", params={"state": "Telangana", "district": "KHAMMAM"}, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    for y in (2021, 2022, 2023):
        assert y in body["yearly"] or str(y) in body["yearly"]
    assert body["status"] in {"depleting", "stable", "improving"}
    assert "current_mbgl" in body and "slope" in body


# ---------- Recommend ----------
def test_recommend(client):
    npk = client.get(f"{BASE_URL}/api/npk",
                     params={"state": "Telangana", "district": "Adilabad"}, timeout=30).json()
    gw = client.get(f"{BASE_URL}/api/groundwater",
                    params={"state": "Telangana", "district": "KHAMMAM"}, timeout=30).json()
    payload = {
        "state": "Telangana",
        "district": "Adilabad",
        "npk": npk,
        "weather": {"temperature_c": 28, "humidity_pct": 65, "rainfall_mm": 25},
        "groundwater": gw,
    }
    r = client.post(f"{BASE_URL}/api/recommend", json=payload, timeout=60)
    assert r.status_code == 200, r.text
    body = r.json()

    tw = body["top5_with_groundwater"]
    two = body["top5_without_groundwater"]
    assert len(tw) == 5 and len(two) == 5

    required = {"suitability_score", "rf_score", "xgb_score", "ml_ensemble_score",
                "water_demand", "groundwater_risk",
                "score_with_groundwater", "score_without_groundwater"}
    for c in tw + two:
        assert required.issubset(c.keys()), f"missing keys: {required - c.keys()}"
        assert c["water_demand"] in {"low", "moderate", "high"}
        assert c["groundwater_risk"] in {"low", "moderate", "high"}

    for k in ("top_with", "top_without", "biggest_drop_crop", "biggest_gain_crop"):
        assert k in body["summary"]

    comp = body["comparison"]
    assert len(comp) <= 5 and len(comp) > 0
    for row in comp:
        assert "rank_change" in row


# ---------- TTS ----------
def test_tts(client):
    r = client.post(f"{BASE_URL}/api/tts",
                    json={"text": "Hello farmer, this is a test"}, timeout=60)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "key" in body and "url" in body
    audio = client.get(f"{BASE_URL}{body['url']}", timeout=30)
    assert audio.status_code == 200
    assert audio.headers.get("content-type", "").startswith("audio/")
    assert len(audio.content) > 500


# ---------- Nearest reference ----------
def test_nearest_reference_bangalore(client):
    """Coords near Bangalore should snap to some Telangana district (data fallback)."""
    r = client.get(f"{BASE_URL}/api/nearest-reference",
                   params={"lat": 12.97, "lon": 77.59}, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["state"] == "Telangana"
    assert isinstance(body["district"], str) and len(body["district"]) > 0
    assert isinstance(body["distance_km"], (int, float)) and body["distance_km"] > 0
    assert "lat" in body and "lon" in body


def test_nearest_reference_kumuram_bheem(client):
    """Coords near northern Telangana should snap to KUMURAM BHEEM."""
    r = client.get(f"{BASE_URL}/api/nearest-reference",
                   params={"lat": 19.5, "lon": 79.0}, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["state"] == "Telangana"
    assert body["district"] == "KUMURAM BHEEM", f"got {body['district']}"


# ---------- ML models on disk ----------
def test_models_saved():
    root = "/app/backend/models"
    for f in ("random_forest.joblib", "xgboost.joblib", "meta.json"):
        assert os.path.exists(f"{root}/{f}"), f"missing {f}"
