"""Random Forest + XGBoost training and inference for crop ranking.

The dataset gives a per-crop 0-3 score on N, P, K, temperature, humidity, ph,
rainfall plus an overall weighted score. We treat the overall score as the
regression target and expose the two models' predictions for use in the
ensemble ranker. Models are saved to /app/backend/models and only retrained
when missing.
"""
from __future__ import annotations
from pathlib import Path
from typing import Any
import json
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import KFold, cross_val_score
from sklearn.metrics import mean_absolute_error, r2_score
from xgboost import XGBRegressor

MODELS_DIR = Path(__file__).parent / "models"
MODELS_DIR.mkdir(exist_ok=True)

FEATURES = [
    "n_score",
    "p_score",
    "k_score",
    "temperature_score",
    "humidity_score",
    "ph_score",
    "rainfall_score",
]

RF_PATH = MODELS_DIR / "random_forest.joblib"
XGB_PATH = MODELS_DIR / "xgboost.joblib"
META_PATH = MODELS_DIR / "meta.json"


def _train(df: pd.DataFrame) -> dict[str, Any]:
    X = df[FEATURES].to_numpy(dtype=float)
    y = df["overall_weighted_score"].to_numpy(dtype=float)

    rf = RandomForestRegressor(n_estimators=200, max_depth=6, random_state=42)
    xgb = XGBRegressor(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.08,
        subsample=0.9,
        random_state=42,
        objective="reg:squarederror",
        verbosity=0,
    )

    # 5-fold CV for honest metrics (small dataset, so leave-one-out-ish CV).
    kf = KFold(n_splits=5, shuffle=True, random_state=42)
    rf_cv_mae = -cross_val_score(rf, X, y, cv=kf, scoring="neg_mean_absolute_error").mean()
    xgb_cv_mae = -cross_val_score(xgb, X, y, cv=kf, scoring="neg_mean_absolute_error").mean()

    rf.fit(X, y)
    xgb.fit(X, y)

    rf_pred = rf.predict(X)
    xgb_pred = xgb.predict(X)

    meta = {
        "features": FEATURES,
        "n_samples": int(len(df)),
        "random_forest": {
            "cv_mae": float(round(rf_cv_mae, 4)),
            "train_r2": float(round(r2_score(y, rf_pred), 4)),
            "feature_importance": {
                f: float(round(v, 4)) for f, v in zip(FEATURES, rf.feature_importances_)
            },
        },
        "xgboost": {
            "cv_mae": float(round(xgb_cv_mae, 4)),
            "train_r2": float(round(r2_score(y, xgb_pred), 4)),
            "feature_importance": {
                f: float(round(v, 4)) for f, v in zip(FEATURES, xgb.feature_importances_)
            },
        },
        "ensemble": {"random_forest_weight": 0.4, "xgboost_weight": 0.6},
    }

    joblib.dump(rf, RF_PATH)
    joblib.dump(xgb, XGB_PATH)
    META_PATH.write_text(json.dumps(meta, indent=2))
    return meta


class MLService:
    def __init__(self, crops_df: pd.DataFrame) -> None:
        if not (RF_PATH.exists() and XGB_PATH.exists() and META_PATH.exists()):
            _train(crops_df)
        self.rf = joblib.load(RF_PATH)
        self.xgb = joblib.load(XGB_PATH)
        self.meta = json.loads(META_PATH.read_text())

    def predict_matrix(self, feature_rows: np.ndarray) -> dict[str, np.ndarray]:
        rf = self.rf.predict(feature_rows)
        xgb = self.xgb.predict(feature_rows)
        w_rf = self.meta["ensemble"]["random_forest_weight"]
        w_xgb = self.meta["ensemble"]["xgboost_weight"]
        ensemble = w_rf * rf + w_xgb * xgb
        return {"rf": rf, "xgb": xgb, "ensemble": ensemble}
