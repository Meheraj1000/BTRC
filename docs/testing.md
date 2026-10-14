# Testing

## Backend

```bash
npm test -w backend
```

Coverage today:

- Geo / overspeed / deviation helpers (unit)
- RBAC matrix (unit)
- Health, auth validation, unauthorized users (API)

Integration cases that need a seeded database (login success, CRUD, SOS,
complaints, GPS ingest) should be run against Docker PostgreSQL after seed.

## Manual acceptance

1. Login as each demo role
2. Confirm unauthorized roles cannot open `/admin/*`
3. Start the simulator and watch the live map
4. Toggle `overspeed` / `deviate` and see alerts
5. Passenger SOS appears on police + government desks
6. Complaint create → admin resolve
7. Download CSV / Excel / PDF reports

## Flutter

Requires the Flutter SDK. `flutter test` after `flutter create .` in `mobile/`.

## ML

No precomputed scores. Evaluate only after `python train_eta.py`.
