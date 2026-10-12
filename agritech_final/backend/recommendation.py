"""Combines soil, weather, groundwater and ML predictions into a final ranking.

Score composition (all normalised to 0-100):
    with_groundwater    = 0.35 * suitability
                        + 0.35 * ml_ensemble
                        + 0.30 * groundwater_sustainability
    without_groundwater = 0.50 * suitability + 0.50 * ml_ensemble
"""
from __future__ import annotations
from typing import Any
import numpy as np
import pandas as pd

from data_service import get_store
from ml_service import MLService, FEATURES

# ---------------------------------------------------------------------------
# Environment → dataset-score mapping.
# ---------------------------------------------------------------------------

def _cat_from_temp(t: float) -> int:
    # Score column in the CSV is 1..3 relative suitability. We convert live
    # values to a 1..3 preference for the crop-score matching.
    if t < 18:
        return 1
    if t < 28:
        return 2
    return 3


def _cat_from_humidity(h: float) -> int:
    if h < 40:
        return 1
    if h < 70:
        return 2
    return 3


def _cat_from_rainfall(rmm: float) -> int:
    # Weekly cumulative mm.
    if rmm < 10:
        return 1
    if rmm < 40:
        return 2
    return 3


def humidity_label(h: float) -> str:
    return ["Low", "Moderate", "High"][_cat_from_humidity(h) - 1]


def rainfall_label(rmm: float) -> str:
    return ["Low", "Moderate", "High"][_cat_from_rainfall(rmm) - 1]


def _npk_cat(v: float) -> int:
    # NPK column is already on the 1..3 scale in the source file.
    return max(1, min(3, int(round(v))))


def _match_score(env_cat: int, crop_score: int) -> float:
    """Higher when crop_score aligns with the environment category (1-3)."""
    diff = abs(env_cat - crop_score)
    return {0: 1.0, 1: 0.6, 2: 0.2}[diff]


# ---------------------------------------------------------------------------
# Water demand & groundwater risk.
# ---------------------------------------------------------------------------

# Curated relative water demand per crop (Low / Moderate / High). Sourced from
# widely-published FAO/ICAR crop-water reference categories; used only for the
# relative Water Demand Score, never for absolute litre claims.
WATER_DEMAND: dict[str, str] = {
    "apple": "moderate", "banana": "high", "blackgram": "low", "chickpea": "low",
    "coconut": "high", "coffee": "high", "cotton": "moderate", "grapes": "moderate",
    "jute": "high", "kidneybeans": "moderate", "lentil": "low", "maize": "moderate",
    "mango": "moderate", "mothbeans": "low", "mungbean": "low", "muskmelon": "moderate",
    "orange": "moderate", "papaya": "moderate", "pigeonpeas": "low", "pomegranate": "low",
    "rice": "high", "watermelon": "moderate",
}

WATER_DEMAND_SCORE = {"low": 100.0, "moderate": 60.0, "high": 25.0}


def groundwater_sustainability(status: str, water_demand: str) -> float:
    """0-100 score. High-demand crops in depleting areas score very low."""
    matrix = {
        "depleting":  {"low": 95.0, "moderate": 55.0, "high": 15.0},
        "stable":     {"low": 90.0, "moderate": 75.0, "high": 55.0},
        "improving":  {"low": 85.0, "moderate": 80.0, "high": 70.0},
    }
    return matrix.get(status, matrix["stable"]).get(water_demand, 60.0)


def groundwater_risk(status: str, water_demand: str) -> str:
    if status == "depleting" and water_demand == "high":
        return "high"
    if status == "depleting" and water_demand == "moderate":
        return "moderate"
    if status == "stable" and water_demand == "high":
        return "moderate"
    if status == "improving":
        return "low" if water_demand != "high" else "moderate"
    if water_demand == "low":
        return "low"
    return "moderate"


# ---------------------------------------------------------------------------
# Main engine.
# ---------------------------------------------------------------------------

class RecommendationEngine:
    def __init__(self) -> None:
        self.store = get_store()
        self.ml = MLService(self.store.crop_table())

    def _suitability_row(
        self,
        crop_row: pd.Series,
        env: dict[str, int],
    ) -> float:
        components = [
            _match_score(env["n"], int(crop_row["n_score"])),
            _match_score(env["p"], int(crop_row["p_score"])),
            _match_score(env["k"], int(crop_row["k_score"])),
            _match_score(env["temp"], int(crop_row["temperature_score"])),
            _match_score(env["hum"], int(crop_row["humidity_score"])),
            _match_score(env["rain"], int(crop_row["rainfall_score"])),
        ]
        return float(np.mean(components)) * 100.0

    def recommend(
        self,
        npk: dict,
        weather: dict,
        groundwater: dict | None,
    ) -> dict[str, Any]:
        crops = self.store.crop_table()
        env = {
            "n": _npk_cat(npk["N"]),
            "p": _npk_cat(npk["P"]),
            "k": _npk_cat(npk["K"]),
            "temp": _cat_from_temp(weather["temperature_c"]),
            "hum": _cat_from_humidity(weather["humidity_pct"]),
            "rain": _cat_from_rainfall(weather["rainfall_mm"]),
        }

        # Suitability per crop.
        suitability = np.array(
            [self._suitability_row(r, env) for _, r in crops.iterrows()]
        )

        # ML on the crop-score matrix (0-100 scale).
        feat = crops[FEATURES].to_numpy(dtype=float)
        ml_pred = self.ml.predict_matrix(feat)
        # Overall_weighted_score in the CSV ranges roughly 1.4-2.6, normalise
        # linearly to 0-100.
        def _to100(arr: np.ndarray) -> np.ndarray:
            lo, hi = arr.min(), arr.max()
            if hi - lo < 1e-6:
                return np.full_like(arr, 50.0)
            return (arr - lo) / (hi - lo) * 100.0

        rf_score = _to100(ml_pred["rf"])
        xgb_score = _to100(ml_pred["xgb"])
        ensemble_score = _to100(ml_pred["ensemble"])

        status = groundwater["status"] if groundwater else "stable"

        rows: list[dict[str, Any]] = []
        for i, (_, crop) in enumerate(crops.iterrows()):
            name = crop["crop"]
            demand = WATER_DEMAND.get(name, "moderate")
            gw_score = groundwater_sustainability(status, demand)
            risk = groundwater_risk(status, demand)

            with_gw = 0.35 * suitability[i] + 0.35 * ensemble_score[i] + 0.30 * gw_score
            without_gw = 0.50 * suitability[i] + 0.50 * ensemble_score[i]

            rows.append({
                "crop": name,
                "suitability_score": round(float(suitability[i]), 1),
                "rf_score": round(float(rf_score[i]), 1),
                "xgb_score": round(float(xgb_score[i]), 1),
                "ml_ensemble_score": round(float(ensemble_score[i]), 1),
                "water_demand": demand,
                "water_demand_score": WATER_DEMAND_SCORE[demand],
                "groundwater_sustainability": round(float(gw_score), 1),
                "groundwater_risk": risk,
                "score_with_groundwater": round(float(with_gw), 1),
                "score_without_groundwater": round(float(without_gw), 1),
            })

        rows_with = sorted(rows, key=lambda r: r["score_with_groundwater"], reverse=True)
        rows_without = sorted(rows, key=lambda r: r["score_without_groundwater"], reverse=True)

        rank_with = {r["crop"]: idx + 1 for idx, r in enumerate(rows_with)}
        rank_without = {r["crop"]: idx + 1 for idx, r in enumerate(rows_without)}

        # IMPORTANT: copy dicts before per-list mutation so that a crop
        # appearing in both top5s doesn't get its rank overwritten by the
        # second loop.
        top5_with = [dict(r) for r in rows_with[:5]]
        top5_without = [dict(r) for r in rows_without[:5]]

        # Reasons for the top crop (built from actual score components).
        def _reasons(r: dict) -> list[str]:
            out = []
            if r["suitability_score"] >= 70:
                out.append("suitable_soil_weather")
            if r["water_demand"] == "low":
                out.append("low_water_demand")
            elif r["water_demand"] == "moderate":
                out.append("balanced_water_demand")
            if r["groundwater_risk"] == "low":
                out.append("low_groundwater_risk")
            if r["ml_ensemble_score"] >= 70:
                out.append("strong_ml_prediction")
            if status == "depleting" and r["water_demand"] != "high":
                out.append("sustainable_for_depleting_gw")
            if not out:
                out.append("balanced_overall_score")
            return out

        for r in top5_with:
            r["reasons"] = _reasons(r)
            r["ml_confidence"] = round(float(r["ml_ensemble_score"]), 1)
            r["rank"] = rank_with[r["crop"]]

        for r in top5_without:
            r["rank"] = rank_without[r["crop"]]

        # Comparison (up to top-5 crops from either ranking, keyed by crop).
        crop_names = list({*[r["crop"] for r in top5_with], *[r["crop"] for r in top5_without]})
        # Order by average rank for a stable list.
        crop_names.sort(key=lambda c: (rank_with[c] + rank_without[c]) / 2)
        crop_names = crop_names[:5]

        comparison = []
        row_by_crop = {r["crop"]: r for r in rows}
        for c in crop_names:
            r = row_by_crop[c]
            comparison.append({
                "crop": c,
                "score_with": r["score_with_groundwater"],
                "score_without": r["score_without_groundwater"],
                "rank_with": rank_with[c],
                "rank_without": rank_without[c],
                "rank_change": rank_without[c] - rank_with[c],  # +ve = moved up with GW
                "water_demand": r["water_demand"],
            })

        # Human comparison summary.
        biggest_drop = min(comparison, key=lambda x: x["rank_change"])
        biggest_gain = max(comparison, key=lambda x: x["rank_change"])
        summary = {
            "status": status,
            "top_with": top5_with[0]["crop"],
            "top_without": top5_without[0]["crop"],
            "biggest_drop_crop": biggest_drop["crop"],
            "biggest_drop_change": biggest_drop["rank_change"],
            "biggest_gain_crop": biggest_gain["crop"],
            "biggest_gain_change": biggest_gain["rank_change"],
        }

        return {
            "top5_with_groundwater": top5_with,
            "top5_without_groundwater": top5_without,
            "comparison": comparison,
            "summary": summary,
            "ml_meta": self.ml.meta,
            "environment_categories": env,
        }
