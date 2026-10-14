# AI / ML research module (experimental)

Status: **Research module / prototype**. Not a production predictor.

This folder trains an ETA model comparison on a **SYNTHETIC** dataset. It is
not real Bangladesh GPS, not a BRTA extract, and not a live traffic feed.

## Why synthetic?

No licensed historical national GPS archive is bundled with this repository.
Fabricating accuracy numbers would violate the academic rule in the FYDP spec.
The generators and trainers are provided so you can produce **your own**
metrics on your machine.

## Setup

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
python generate_synthetic_eta.py --n 4000
python train_eta.py
```

Then open `notebooks/eta_prediction.ipynb`.

## Models compared

- Linear Regression
- Random Forest
- Gradient Boosting
- XGBoost (if the package imports)

## Metrics

MAE, RMSE, R² are written to `results/eta_metrics.json` **only after you run
the trainer**. Do not invent values for the report.

## Future modules (not implemented)

- Accident risk prediction
- Abnormal driving (rule-based lives in the backend today)
- Traffic forecasting
- Driver risk scoring
- Congestion prediction

The backend ETA endpoint is a separate **rule-based prototype**
(`GET /api/gps/buses/:id/eta`) and does not load these pickle files unless you
wire that integration later.
