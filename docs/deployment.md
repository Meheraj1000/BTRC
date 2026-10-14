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
