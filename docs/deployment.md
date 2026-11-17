# Deployment

## Local (Node)

1. Copy `.env.example` to `.env` and set JWT + database secrets
2. Start PostgreSQL 16
3. `npm install`
4. `npx prisma migrate deploy` from `backend/` (or `npm run db:migrate` for local dev)
5. `npm run db:seed`
6. `npm run dev:backend`
7. `npm run dev:frontend`
8. `npm run dev:simulator`

## Docker

```bash
copy .env.example .env
docker compose up --build
```

Simulator profile:

```bash
docker compose --profile sim up --build
```

Then seed once:

```bash
docker compose exec backend npx tsx prisma/seed.ts
```

## Production notes

- Generate long JWT secrets
- Do not use demo passwords
- Keep `GPS_SOURCE_MODE=SIMULATION` until a real device exists
- Put the API behind TLS (nginx / cloud load balancer)
- Back up PostgreSQL
- Restrict CORS to the real frontend origin
- Asia/Dhaka for display; store UTC in the database

## Cloud

The stack is cloud-ready: containerized API, Next.js standalone-capable
frontend, managed PostgreSQL, optional Redis. No vendor lock-in is required.

## Vercel API deployment

The frontend and Express API must be deployed as separate Vercel projects. For
the API project, select this repository and set its Root Directory to
`backend`. Vercel serves the Express app exported from `src/index.ts`; the
project build command generates Prisma Client and type-checks the backend.

Set these Production environment variables in the API project:

- `DATABASE_URL`: the managed PostgreSQL connection string, preferably using
  the provider's pooled connection endpoint
- `JWT_SECRET` and `JWT_REFRESH_SECRET`: separate random secrets, at least 16
  characters each
- `FRONTEND_URL`: `https://nirapad-transit.vercel.app`

Apply database migrations to the hosted database before sending traffic:
`npm run prisma:deploy -w backend`. Do not commit the database URL or JWT
secrets.

After deploying the API, set `API_ORIGIN` in the frontend Vercel project to the
API deployment's origin (for example, `https://your-api.vercel.app`, without an
`/api` suffix), then redeploy the frontend. This environment setting takes
precedence over the temporary Edge Config tunnel address.

Vercel Functions do not provide a persistent Socket.IO server. Use a separate
long-running service for WebSocket features if they are required.
