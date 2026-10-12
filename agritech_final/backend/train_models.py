"""Manual model training entry point. Run:  python -m train_models
Deletes any existing model artefacts and retrains from scratch."""
from pathlib import Path
from data_service import get_store
from ml_service import _train, RF_PATH, XGB_PATH, META_PATH

if __name__ == "__main__":
    for p in (RF_PATH, XGB_PATH, META_PATH):
        Path(p).unlink(missing_ok=True)
    meta = _train(get_store().crop_table())
    print("Trained. RF CV-MAE:", meta["random_forest"]["cv_mae"],
          "XGB CV-MAE:", meta["xgboost"]["cv_mae"])
