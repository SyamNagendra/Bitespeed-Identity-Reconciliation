# Bitespeed Identity Reconciliation API

Production-ready Node.js + TypeScript backend for identity reconciliation. Given an email and/or phone number, it finds or creates contacts and returns a consolidated view with a single primary contact and all linked secondaries.

## Tech Stack

- **Runtime:** Node.js 18+
- **Language:** TypeScript
- **Framework:** Express
- **ORM:** Prisma
- **Database:** PostgreSQL

## Project Structure

```
src/
  config/         # Environment and database
  controllers/    # HTTP request handlers
  middleware/     # Validation, error handling
  routes/         # Route definitions
  services/       # Business logic (identify reconciliation)
  types/          # TypeScript types
  app.ts          # Express app
  index.ts        # Entry point
prisma/
  schema.prisma   # Contact model and migrations
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example env and set your PostgreSQL URL:

```bash
cp .env.example .env
```

Edit `.env` and set `DATABASE_URL`:

```
DATABASE_URL="postgresql://user:password@localhost:5432/bitespeed?schema=public"
PORT=3000
NODE_ENV=development
```

### 3. Run database migrations

```bash
npm run db:generate
npm run db:migrate:dev
```

For production (apply existing migrations only):

```bash
npm run db:migrate
```

### 4. Start the server

**Development** (with hot reload):

```bash
npm run dev
```

**Production** (build then run):

```bash
npm run build
npm start
```

The API will be available at `http://localhost:3000` (or the port set in `PORT`).

## API

### Health check

- **GET** `/health`  
  Returns `{ "status": "ok", "timestamp": "..." }`.

### Identify (reconciliation)

- **POST** `/identify`  
  Request body (JSON):

  ```json
  {
    "email": "user@example.com",
    "phoneNumber": "+1234567890"
  }
  ```

  At least one of `email` or `phoneNumber` must be provided and non-empty. Both can be omitted or null for validation to fail.

  **Response** (200):

  ```json
  {
    "contact": {
      "primaryContactId": 1,
      "emails": ["user@example.com"],
      "phoneNumbers": ["+1234567890"],
      "secondaryContactIds": [2, 3]
    }
  }
  ```

  - **primaryContactId:** ID of the oldest primary contact in the cluster.
  - **emails:** Unique emails from the primary and all linked secondaries.
  - **phoneNumbers:** Unique phone numbers from the same set.
  - **secondaryContactIds:** IDs of all contacts in the cluster that are not the primary.

## Logic Summary

1. **No existing contact** for the given email or phone → create a new **primary** contact with the provided email/phone.
2. **Existing contact(s) found:**
   - Collect all **connected** contacts (same email/phone or linked via `linkedId`).
   - Choose the **oldest primary** (by `createdAt`) as the single primary.
   - **Convert** any other primaries in the cluster to **secondary**, linked to that primary; update secondaries that pointed to converted primaries to point to the chosen primary.
   - If the request has an **email or phone not yet in the cluster** → create a new **secondary** contact linked to the primary.
3. Response is built from the **primary** and all linked contacts (emails, phone numbers, secondary IDs).

## Edge Cases Handled

- **Email only** or **phone only** in the request (one can be null/omitted).
- **Null/empty input:** Validation returns 400 if both `email` and `phoneNumber` are missing or empty.
- **Multiple primaries:** Newer primaries are converted to secondary and linked to the oldest primary.
- **New info:** New email or phone in the request creates a new secondary linked to the primary.

## Scripts

| Script            | Description                          |
|-------------------|--------------------------------------|
| `npm run dev`     | Run with ts-node-dev (hot reload)   |
| `npm run build`   | Compile TypeScript to `dist/`       |
| `npm start`       | Run compiled app                    |
| `npm run db:generate` | Generate Prisma client          |
| `npm run db:migrate`  | Deploy migrations (prod)        |
| `npm run db:migrate:dev` | Create/apply migrations (dev)  |
| `npm run db:studio`    | Open Prisma Studio               |
| `npm run typecheck`   | Run `tsc --noEmit`               |

## Deployment

- Set `NODE_ENV=production` and a production `DATABASE_URL`.
- Run `npm run db:migrate` after deploy to apply migrations.
- Start with `npm run build && npm start`, or use the included Dockerfile.

### Docker

Build and run with Docker:

```bash
docker build -t bitespeed-identify .
docker run -p 3000:3000 -e DATABASE_URL="postgresql://..." bitespeed-identify
```

Ensure the database is reachable from the container and migrations have been applied (e.g. in CI or a separate migration step).
