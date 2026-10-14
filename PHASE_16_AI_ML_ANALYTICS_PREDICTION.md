# PHASE 16 — AI/ML ANALYTICS & PREDICTION

## 1. AI/ML audit

### Existing ML components

The repository contains an experimental ML module under `ml/`:

- `ml/generate_synthetic_eta.py`
- `ml/train_eta.py`
- `ml/README.md`
- `ml/notebooks/eta_prediction.ipynb`
- `ml/models/.gitkeep`
- `ml/data/.gitkeep`

This folder is explicitly described as a research prototype, not a production predictor.

### What the code actually does

The script `ml/generate_synthetic_eta.py` creates a synthetic ETA dataset with generated features such as:

- distance_km
- speed_kmh
- time_of_day
- day_of_week
- weather
- traffic
- route
- eta_minutes

The script `ml/train_eta.py` trains a small set of regression models on this synthetic dataset:

- Linear Regression
- Random Forest Regressor
- Gradient Boosting Regressor
- XGBoost, if installed

The model is evaluated using:

- MAE
- RMSE
- R²

The metrics are written to `ml/results/eta_metrics.json` only after an actual local run of the training script.

### Data source and classification

The current ML dataset is synthetic and generated locally. The project documentation is explicit that it is not:

- Bangladesh government GPS
- BRTA record data
- a live traffic feed
- a real public transport dataset

This means the ML pipeline is properly described as experimental and bounded to synthetic data.

### Model status

There is no trained production model loaded in the live backend or frontend. The project does not claim a production AI deployment.

### Backend integration status

The backend analytics endpoints do exist and provide operational analytics based on the real project database, but they do not use the experimental Python model pipeline as a production backend ML service.

### Frontend integration status

The frontend has dashboards and analytics views driven by real backend analytics data. The visual layer is not fake. It is part of the project’s operational reporting system.

### Experimental vs implemented distinction

Implemented:

- analytics endpoints for overview, series, activity, buses, drivers, routes
- role-scoped dashboard analytics
- report generation and summary data
- deterministic route compliance analytics

Experimental:

- ETA model comparison on synthetic data
- model training and evaluation scripts in `ml/`
- notebook experimentation

Not implemented:

- production ML deployment
- live government AI integration
- real-world trained ETA model using national data
- real predictive dispatch or route optimization

## 2. Data availability and data quality

### Available project data sources

The system has real operational data available in PostgreSQL/Prisma, including:

- GPS locations and timestamps
- route and stop metadata
- bus assignment and status
- driver assignment and status
- trip records
- compliance events
- alerts
- complaints
- SOS records
- notifications
- company ownership data

### What is missing for meaningful production AI

The project does not include a large validated historical transport dataset, which is required for a production-grade ETA or anomaly model. The ML folder is intentionally synthetic and research-only.

### Data quality characteristics

The system does include validation for:

- invalid coordinates
- unrealistic GPS jumps
- route compliance state
- status checks
- negative or invalid data entries

This is a strong operational foundation for analytics, but not sufficient for a production-quality predictive model without additional real historical data.

## 3. Feature engineering

The actual synthetic feature set in the ML pipeline includes:

- distance
- speed
- time of day
- day of week
- weather
- traffic level
- route identifier

This is legitimate for a synthetic ETA experiment. The feature set is transparent and reproducible.

The project also performs operational analytics via the real database in [backend/src/services/analytics.service.ts](backend/src/services/analytics.service.ts), including counts and grouped summaries. That is not ML-based but is a valid analytics layer.

## 4. Appropriate ML tasks for this project

The current project can support analytics in a legitimate way, but only with a careful distinction between:

- deterministic analytics
- experimental model comparison
- future ML work

### Supported by actual project data

- route and fleet summary analytics
- compliance event summaries
- speed/overspeed counts
- trip counts and operational summaries
- route deviation analytics via existing deterministic compliance logic

### Experimental only

- ETA prediction on synthetic data
- model comparison pipeline

### Future work

- production-grade travel-time prediction from real trip history
- real delay forecasting with verified historical data
- accident risk prediction
- traffic forecasting
- production-level anomaly detection

## 5. Training and evaluation

The project’s synthetic ETA training script is reproducible in principle and uses a conventional train/test split.

The script follows a normal ML flow:

1. data generation
2. train/test split
3. preprocessing with OneHotEncoder for categorical features
4. model fitting
5. evaluation with MAE, RMSE, and R²
6. serialization with joblib
7. metrics output to a JSON file

This is valid for an experimental notebook/research run, but not a real production model.

## 6. Model performance reporting

The project is careful not to fake or claim metrics without running the script. The README explicitly says metrics must be produced by the local run and should not be invented.

Because Python is not available in this environment, no fresh model training run was possible here. The project reports only the actual implementation and its limitations.

## 7. Backend and frontend integration

### Backend analytics integration

The real backend provides analytics endpoints such as:

- `/analytics/overview`
- `/analytics/series`
- `/analytics/activity`
- `/analytics/buses`
- `/analytics/drivers`
- `/analytics/routes`
- `/analytics/alerts`

These are integrated and role-scoped.

### Backend ML integration

No production backend ML endpoint was found that loads the Python model and exposes live predictions from the application. The synthetic model pipeline remains separate.

### Frontend analytics integration

The frontend dashboard and pages consume the analytics API. This is real analytics integration, but it is not a live ML prediction endpoint.

## 8. Role-based analytics access

The project preserves existing RBAC behavior. Transport owners see only their own fleet analytics, government roles access authorized operational views, and passengers do not receive internal operational ML data or private route/driver metrics.

## 9. Security and privacy

The analytics and AI-related code is not a risk if it remains bound to the project’s existing auth, RBAC, and ownership system. The project does not expose model internals or arbitrary Python execution to users.

The key safe boundary is that no untrusted model path or arbitrary user code is accepted by the app. This is consistent with the project’s architecture.

## 10. Performance nature

The current system avoids overloading the app with a heavy prediction pipeline at every realtime update. The analytics APIs are aggregate-oriented and scoped. This is the right pattern for the project’s phase and data limits.

## 11. Database / Prisma

No schema change was required for Phase 16. No destructive migration or reset was performed. The project remains aligned with the existing database and Prisma model structure.

## 12. Testing evidence

The project’s full backend regression baseline remained green prior to this phase:

- 20 test files passed
- 116 tests passed

The project also had a successful production frontend build.

## 13. Python/ML environment status

The local environment lacked a working Python executable, so the synthetic trainer could not be executed here. This is an environment limitation, not a code-level claim. The project therefore reports ML-related execution as not performed in this environment and does not invent any metrics.

## 14. Known limitations

- The current ML module is synthetic-only and not connected to real transport data.
- No real national or government operational dataset is included.
- No production-trained predictive model is loaded in the app.
- No real-world ETA accuracy claims are made.
- No claim is made that the project deploys AI at production scale.

## 15. Future ML work

Future work would require:

- validated historical trip and GPS datasets
- route and time-window coverage
- structured labels for delays, anomalies, and route disruptions
- a realistic feature pipeline and temporal train/test handling
- careful careful evaluation and data governance

Until then, the project is best described as an experimental AI/ML research module plus real operational analytics.

## 16. Final assessment

The project contains a legitimate experimental ML foundation and a production-safe analytics layer, but it does not have a live trained production predictive model. The honest Phase 16 status is that the system supports synthetic AI experimentation and real analytics, while meaningful predictive deployment remains future work.
