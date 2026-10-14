"""Generate a SYNTHETIC ETA research dataset.

This is not Bangladesh government GPS, not a public transport agency dump,
and not real vehicle traces. It is constructed for the FYDP experiment so
models can be trained when no licensed historical feed is available.

Every row is labeled data_source=SYNTHETIC.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

ROUTES = ["DHK-01", "DHK-02", "DHK-03", "DHK-04", "CTG-05", "SYL-06", "RAJ-07", "KHL-08"]
WEATHER = ["clear", "rain", "haze"]
TRAFFIC = ["low", "medium", "high"]


def generate(n: int, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    distance = rng.uniform(1.5, 28.0, n)
    time_of_day = rng.integers(0, 24, n)
    day_of_week = rng.integers(0, 7, n)
    weather = rng.choice(WEATHER, n, p=[0.62, 0.25, 0.13])
    traffic = rng.choice(TRAFFIC, n, p=[0.35, 0.4, 0.25])
    route = rng.choice(ROUTES, n)
    speed = rng.uniform(10, 42, n)

    weather_pen = np.where(weather == "rain", 1.22, np.where(weather == "haze", 1.08, 1.0))
    traffic_pen = np.where(traffic == "high", 1.45, np.where(traffic == "medium", 1.18, 1.0))
    rush = np.where((time_of_day >= 7) & (time_of_day <= 10) | ((time_of_day >= 16) & (time_of_day <= 20)), 1.35, 1.0)
    weekend = np.where(day_of_week >= 5, 0.9, 1.0)
    noise = rng.normal(0, 2.2, n)

    eta_minutes = (distance / np.maximum(speed, 8.0)) * 60 * weather_pen * traffic_pen * rush * weekend + noise
    eta_minutes = np.clip(eta_minutes, 3, 180)

    return pd.DataFrame(
        {
            "distance_km": distance.round(3),
            "speed_kmh": speed.round(2),
            "time_of_day": time_of_day,
            "day_of_week": day_of_week,
            "weather": weather,
            "traffic": traffic,
            "route": route,
            "eta_minutes": eta_minutes.round(2),
            "data_source": "SYNTHETIC",
            "data_note": "Constructed for research. Not real Bangladesh GPS.",
        }
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--n", type=int, default=4000)
    parser.add_argument("--out", type=Path, default=Path(__file__).parent / "data" / "synthetic_eta.csv")
    args = parser.parse_args()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    df = generate(args.n)
    df.to_csv(args.out, index=False)
    print(f"Wrote {len(df)} SYNTHETIC rows to {args.out}")


if __name__ == "__main__":
    main()
