# Nirapad Transit

**AI-Enabled National Smart Public Transport Management and Safety System Using GPS and Real-Time Monitoring for Bangladesh**

Final Year Design Project (FYDP) — research + software implementation.

This repository is a **working multi-role platform** (APIs, RBAC, PostgreSQL, live map, WebSocket, GPS simulator, dashboards, Flutter clients, ML experiment). It is **not** connected to a live government system or a physical GPS modem unless you change configuration and provide those integrations yourself.

> DEMO / SIMULATION ENVIRONMENT. Seeded buses, drivers, companies and routes are demo data. They are not BRTA or police records.

## Features (implemented)

- JWT authentication and seven-role RBAC
- Admin, government, BRTA, police, owner, driver, passenger web apps
- Bus / driver / company / route / GPS device management
- GPS ingest + simulator along Bangladesh city demo corridors
- OpenStreetMap + Leaflet live map (green / yellow / red)
- Overspeed and route-deviation alerts
- SOS and complaint workflows
- In-app notifications (architecture allows future SMS / email / push)
- Analytics cards and 7-day series
- CSV / Excel / PDF reports
- Audit logs and system settings
- Docker Compose
- Flutter passenger + driver app source
- Experimental ETA ML module on **synthetic** data

## Technology

| Layer | Choice |
| --- | --- |
| Web | Next.js 14, TypeScript, Tailwind CSS |
| API | Node.js, Express, Prisma, Socket.IO |
| Database | PostgreSQL 16 |
| Maps | OpenStreetMap + Leaflet |
| Mobile | Flutter |
| ML | Python, scikit-learn, XGBoost |
| Ops | Docker Compose |

## Quick start

Prerequisites: Node.js 20+, PostgreSQL 16 (or Docker).

```bash
copy .env.example .env
# set JWT_SECRET, JWT_REFRESH_SECRET, DATABASE_URL

npm install
cd backend
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
cd ..
npm run dev:backend
npm run dev:frontend
npm run dev:simulator
```

Web: [http://localhost:3000](http://localhost:3000)  
API: [http://localhost:4000/health](http://localhost:4000/health)

### Demo accounts

Password for all seeded users: `Demo@12345`

| Role | Email |
| --- | --- |
| Super Admin | admin@nirapad.gov.bd |
| Government | government@nirapad.gov.bd |
| BRTA | brta@nirapad.gov.bd |
| Police | police@nirapad.gov.bd |
| Owner | owner.greenline@demo.bd |
| Driver | driver.rahim@demo.bd |
| Passenger | passenger.fatima@demo.bd |

## Project layout

```
backend/          Express API
frontend/         Next.js dashboards
mobile/           Flutter passenger + driver
gps-simulator/    Development GPS feeder
ml/               FYDP ETA experiment
docs/             Architecture and API notes
database/         Schema notes
docker-compose.yml
```

## Documentation

- [Architecture](docs/architecture.md)
- [Database](docs/database.md)
- [API](docs/api.md)
- [GPS tracking](docs/gps-tracking.md)
- [AI module](docs/ai-module.md)
- [Deployment](docs/deployment.md)
- [Testing](docs/testing.md)
- [Mobile](mobile/README.md)
- [ML](ml/README.md)

## Academic labels

| Feature | Classification |
| --- | --- |
| Auth, RBAC, CRUD, GPS ingest, maps, SOS, complaints, reports | Implemented |
| Simulator, heuristic ETA, rule-based driving alerts | Prototype |
| sklearn / XGBoost ETA comparison | Experimental (synthetic) |
| Accident ML, traffic forecast, government API, physical GPS | Future work |

Do not fabricate accuracy, dataset size, or live national deployment claims.

## License

Academic / FYDP use. Replace secrets before any public hosting.
