# Database notes

Canonical schema: `backend/prisma/schema.prisma`.

See `docs/database.md` for relationships and indexes.

After PostgreSQL is running:

```bash
cd backend
npx prisma db push
npx tsx prisma/seed.ts
```
