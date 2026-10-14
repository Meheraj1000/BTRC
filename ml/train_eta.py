"""Train and evaluate ETA models on the SYNTHETIC dataset.

Prints MAE, RMSE and R^2 from the actual run. Do not copy numbers into the
FYDP report unless this script (or the notebook) was executed on your machine.
"""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

try:
    from xgboost import XGBRegressor
except Exception:  # pragma: no cover - optional
    XGBRegressor = None


ROOT = Path(__file__).parent
DATA = ROOT / "data" / "synthetic_eta.csv"
MODELS = ROOT / "models"
RESULTS = ROOT / "results"


def metrics(y_true, y_pred) -> dict:
    return {
        "mae": float(mean_absolute_error(y_true, y_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_true, y_pred))),
        "r2": float(r2_score(y_true, y_pred)),
    }


def main() -> None:
    if not DATA.exists():
        raise SystemExit("Run generate_synthetic_eta.py first.")

    df = pd.read_csv(DATA)
    assert set(df["data_source"].unique()) == {"SYNTHETIC"}

    y = df["eta_minutes"]
    X = df[["distance_km", "speed_kmh", "time_of_day", "day_of_week", "weather", "traffic", "route"]]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    pre = ColumnTransformer(
        [
            ("num", "passthrough", ["distance_km", "speed_kmh", "time_of_day", "day_of_week"]),
            ("cat", OneHotEncoder(handle_unknown="ignore"), ["weather", "traffic", "route"]),
        ]
    )

    models = {
        "linear_regression": LinearRegression(),
        "random_forest": RandomForestRegressor(n_estimators=200, random_state=42, n_jobs=-1),
        "gradient_boosting": GradientBoostingRegressor(random_state=42),
    }
    if XGBRegressor is not None:
        models["xgboost"] = XGBRegressor(
            n_estimators=250,
            learning_rate=0.08,
            max_depth=5,
            subsample=0.9,
            colsample_bytree=0.9,
            random_state=42,
            n_jobs=-1,
        )

    MODELS.mkdir(exist_ok=True)
    RESULTS.mkdir(exist_ok=True)
    table = {}
    for name, model in models.items():
        pipe = Pipeline([("pre", pre), ("model", model)])
        pipe.fit(X_train, y_train)
        pred = pipe.predict(X_test)
        table[name] = metrics(y_test, pred)
        joblib.dump(pipe, MODELS / f"{name}.joblib")
        print(name, table[name])

    payload = {
        "dataset": "synthetic_eta.csv",
        "data_source": "SYNTHETIC",
        "n_rows": int(len(df)),
        "n_train": int(len(X_train)),
        "n_test": int(len(X_test)),
        "metrics": table,
        "note": "Metrics are from this local run on synthetic data only.",
    }
    (RESULTS / "eta_metrics.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print("Wrote", RESULTS / "eta_metrics.json")


if __name__ == "__main__":
    main()
