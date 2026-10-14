# AI module

## Implemented now

| Piece | Status | Honesty label |
| --- | --- | --- |
| Overspeed detection | Rule-based | Operational |
| Route deviation | Rule-based | Operational |
| Abnormal driving (speed / deviation) | Rule-based | Prototype |
| ETA HTTP endpoint | Heuristic (distance, speed, hour) | Prototype |
| ETA model comparison | Python / sklearn | Experimental, SYNTHETIC data |

## Not implemented (future)

- Accident risk classifier
- Traffic prediction
- Driver risk scoring beyond simple decrement on violations
- Congestion prediction
- Loading `ml/models/*.joblib` into the Node API

## How to run the experiment

See `ml/README.md`. Report only metrics that appear in
`ml/results/eta_metrics.json` after a local training run.
