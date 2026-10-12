"""Loads and aggregates the three datasets (soil NPK, groundwater, crop scores).

All data is cached in memory. State/District normalisation is done here so
callers can pass either lower/upper/mixed case values.
"""
from pathlib import Path
from typing import Optional
import pandas as pd
import numpy as np

DATA_DIR = Path(__file__).parent / "data"


def _norm(s: str) -> str:
    return "".join(ch for ch in str(s).lower().strip() if ch.isalnum())


class DataStore:
    def __init__(self) -> None:
        self.npk = pd.read_csv(DATA_DIR / "final_npk.csv")
        self.gwl = pd.read_csv(DATA_DIR / "GWL_Cleaned.csv")
        self.crops = pd.read_csv(DATA_DIR / "crop_scores.csv")

        # Aggregate NPK: mean per (State, District) in case of duplicates.
        self.npk_agg = (
            self.npk.groupby(["State", "District"], as_index=False)[["N", "P", "K"]]
            .mean()
        )
        self.npk_agg["_state_key"] = self.npk_agg["State"].map(_norm)
        self.npk_agg["_district_key"] = self.npk_agg["District"].map(_norm)

        # Aggregate GWL: median per (State, District, Year) → resistant to outliers,
        # then keep years 2021+ only per the spec (data covers 2021-2023).
        self.gwl["_state_key"] = self.gwl["State"].map(_norm)
        self.gwl["_district_key"] = self.gwl["District"].map(_norm)
        self.gwl = self.gwl[self.gwl["Year"] >= 2021].dropna(subset=["GWL_mbgl"])
        self.gwl_year = (
            self.gwl.groupby(["_state_key", "_district_key", "Year"], as_index=False)[
                "GWL_mbgl"
            ]
            .median()
        )

    # --- lookups ------------------------------------------------------------

    def known_states(self) -> list[str]:
        return sorted(self.npk_agg["State"].unique().tolist())

    def known_districts(self, state: str) -> list[str]:
        sk = _norm(state)
        return sorted(
            self.npk_agg.loc[self.npk_agg["_state_key"] == sk, "District"].unique().tolist()
        )

    def npk_for(self, state: str, district: str) -> Optional[dict]:
        sk, dk = _norm(state), _norm(district)
        row = self.npk_agg[
            (self.npk_agg["_state_key"] == sk) & (self.npk_agg["_district_key"] == dk)
        ]
        if row.empty:
            # Fallback: state-level mean if district not found (spec: graceful fallback).
            row = self.npk_agg[self.npk_agg["_state_key"] == sk]
            if row.empty:
                return None
            return {
                "N": float(row["N"].mean()),
                "P": float(row["P"].mean()),
                "K": float(row["K"].mean()),
                "matched_state": row.iloc[0]["State"],
                "matched_district": "STATE AVERAGE",
                "fallback": "state_mean",
            }
        r = row.iloc[0]
        return {
            "N": float(r["N"]),
            "P": float(r["P"]),
            "K": float(r["K"]),
            "matched_state": r["State"],
            "matched_district": r["District"],
            "fallback": None,
        }

    def groundwater_for(self, state: str, district: str) -> Optional[dict]:
        sk, dk = _norm(state), _norm(district)
        sub = self.gwl_year[
            (self.gwl_year["_state_key"] == sk) & (self.gwl_year["_district_key"] == dk)
        ]
        fallback = None
        if sub.empty:
            sub = self.gwl_year[self.gwl_year["_state_key"] == sk]
            fallback = "state_mean"
        if sub.empty:
            return None

        if fallback == "state_mean":
            sub = sub.groupby("Year", as_index=False)["GWL_mbgl"].mean()

        sub = sub.sort_values("Year").reset_index(drop=True)
        yearly = {int(r["Year"]): float(round(r["GWL_mbgl"], 2)) for _, r in sub.iterrows()}

        if len(sub) >= 2:
            # Linear regression slope (mbgl per year). +ve slope = mbgl growing =
            # water table getting deeper = depletion.
            x = sub["Year"].to_numpy(dtype=float)
            y = sub["GWL_mbgl"].to_numpy(dtype=float)
            slope, intercept = np.polyfit(x, y, 1)
            slope = float(slope)
            avg = float(y.mean())
            pct = (slope / avg * 100.0) if avg else 0.0
        else:
            slope = 0.0
            pct = 0.0

        # Classification per spec (mbgl: bigger = deeper = worse).
        if slope > 0.25:
            status = "depleting"
        elif slope < -0.25:
            status = "improving"
        else:
            status = "stable"

        current = float(sub.iloc[-1]["GWL_mbgl"])
        return {
            "yearly": yearly,
            "current_mbgl": round(current, 2),
            "slope": round(slope, 3),
            "trend_pct": round(pct, 2),
            "status": status,
            "years_available": len(yearly),
            "fallback": fallback,
        }

    def crop_table(self) -> pd.DataFrame:
        return self.crops.copy()


STORE: Optional[DataStore] = None


def get_store() -> DataStore:
    global STORE
    if STORE is None:
        STORE = DataStore()
    return STORE
