# Blog API

A production-oriented REST API for a blogging platform, built with **Express 5**, **TypeScript**, and **PostgreSQL**.

The project started as a plain JavaScript service and was fully migrated to TypeScript (`tsc --noEmit` passes clean). Its focus is less on feature count and more on the things that are usually skipped: layered security, real test coverage, and observability that survives an incident.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Security](#security)
- [Observability](#observability)
- [Testing](#testing)
- [Design Decisions](#design-decisions)
- [Roadmap](#roadmap)

---

## Features

- **Authentication** — JWT access tokens with refresh token rotation and reuse detection
- **Authorization** — role-based permissions plus per-object ownership checks
- **Articles** — full CRUD with field-level write control
- **Validation** — every request body parsed through Zod schemas
- **Security** — rate limiting, security headers, CORS allow-list, parameterized SQL
- **Observability** — structured JSON logs with a request ID that links client responses to server logs
- **Testing** — unit tests for token utilities, integration tests covering the full auth surface

---

## Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 18+ |
| Language | TypeScript |
| Framework | Express 5 |
| Database | PostgreSQL (`pg`) |
| Validation | Zod |
| Auth | JWT (`jsonwebtoken`) + bcrypt |
| Rate limiting | `express-rate-limit` |
| Headers | Helmet |
| Testing | Jest (`ts-jest`) + Supertest |
| Linting | ESLint (flat config) + Prettier |

---

## Project Structure

```
blog/
├── app.ts                      # Express app: middleware order, route mounting
├── server.ts                   # Entry point, DB connection check, port binding
├── routes/
│   ├── authRoutes.ts
│   └── articleRoutes.ts
├── controllers/
│   ├── auth.controller.ts
│   ├── auth.controller.test.ts # Integration tests (Supertest)
│   └── article.controller.ts
├── models/                     # SQL queries and data access
│   ├── user.model.ts
│   ├── article.model.ts
│   └── refreshToken.model.ts
├── middleware/
│   ├── requestId.ts            # Generates a UUID per request
│   ├── rateLimiters.ts         # generalLimiter, authLimiter, passwordLimiter
│   ├── auth.ts                 # authMiddleWare (verifies JWT) + authorize (roles)
│   ├── validate.ts             # Runs a Zod schema against the request
│   └── errorHandler.ts         # Terminal error handler
├── validators/                 # Zod schemas
│   ├── auth.validator.ts
│   └── article.validator.ts
├── utils/
│   ├── AppError.ts             # Operational error class
│   ├── catchAsync.ts           # Async error wrapper
│   ├── env.ts                  # requireEnv — fail fast on missing config
│   ├── logger.ts               # Structured logger
│   ├── token.ts                # Access / refresh token generation
│   └── token.test.ts           # Unit tests
├── config/
│   └── db.ts                   # pg Pool
└── src/types/
    └── express.d.ts            # Declaration merging (req.user)
```

Tests live beside the code they cover rather than in a separate `tests/` tree; Jest picks them up via `testMatch: ["**/*.test.ts"]`.

---

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### Install

```bash
git clone git@github.com:baraafanah21/blog.git
cd blog
npm install
```

### Database

Create the database:

```bash
createdb blog
```

The schema is not yet checked into the repo (see [Roadmap](#roadmap)). Three tables are required:

| Table | Purpose |
|---|---|
| `users` | Credentials, `role`, and `token_version` for global revocation |
| `articles` | Article records with an owner column |
| `refresh_tokens` | Hashed refresh tokens, supporting rotation and reuse detection |

### Run

```bash
npm run dev     # development with auto-reload (tsx watch)
npm run build   # compile TypeScript to dist/
npm start       # run compiled output
npm run lint    # ESLint
npm run format  # Prettier --write
```

The server listens on port `3000` by default and verifies the database connection on startup, exiting with code 1 if it fails.

> **Note:** after editing source files, confirm the running process actually picked up the change. A stale process returns perfectly valid responses from old code, which is difficult to diagnose. A quick check: hit any endpoint and confirm the `X-Request-Id` header is present.

---

## Environment Variables

Create a `.env` file in the project root:

```env
PORT=3000
NODE_ENV=development

DATABASE=postgresql://user:password@localhost:5432/blog

ACCESS_TOKEN_SECRET=<long-random-string>
REFRESH_TOKEN_SECRET=<different-long-random-string>

ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com
```

`DATABASE`, `ACCESS_TOKEN_SECRET`, and `REFRESH_TOKEN_SECRET` are read through `requireEnv` in [`utils/env.ts`](utils/env.ts), which throws at startup if a value is missing — a missing secret is a crash, never a silently weaker signature.

The two token secrets are deliberately distinct: a refresh token must not be accepted anywhere an access token is expected.

`ALLOWED_ORIGINS` is a comma-separated allow-list. An origin not on the list receives no CORS headers at all.

Token lifetimes (15m access, 7d refresh) and the bcrypt cost factor are currently hardcoded; moving them to configuration is on the roadmap.

---

## API Reference

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/signup` | — | Register a new user |
| `POST` | `/auth/login` | — | Returns access + refresh tokens (rate limited) |
| `POST` | `/auth/refresh` | — | Rotates the refresh token |
| `POST` | `/auth/logout` | ✅ | Revokes the presented session, or all sessions if no token is sent |
| `PATCH` | `/auth/updatepassword` | ✅ | Change password (step-up rate limited) |

### Articles

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/articles/allarticles` | — | List all articles |
| `GET` | `/articles/article/:id` | — | Get one article |
| `POST` | `/articles/create` | ✅ `admin`/`editor` | Create an article |
| `PATCH` | `/articles/:id` | ✅ `admin`/`editor` | Partial update (owner only) |
| `DELETE` | `/articles/:id` | ✅ | Delete (owner only) |

> **Known inconsistency:** `GET` uses `/articles/article/:id` while `PATCH` and `DELETE` use `/articles/:id` for the same resource. Unifying these is on the roadmap; the old path should be kept alongside the new one so existing clients don't break.

### Error Responses

Every error returns the same shape:

```json
{
  "message": "Something Wrong!",
  "requestId": "d00a3ce2-0264-4143-a9f5-0021a82d7bed"
}
```

Operational errors (`AppError`) return their own message. Anything unexpected returns a generic message — the real message goes to the logs only. Quote the `requestId` when reporting a problem; it maps directly to the full server-side trace.

---

## Security

Security here is treated as a **chain of questions at boundaries**, not a checklist of topics. The layers overlap deliberately.

### Rate Limiting

Three limiters, three keys, three positions in the chain:

| Limiter | Key | Position |
|---|---|---|
| `generalLimiter` | IP | App-wide, before body parsing — cheapest check first |
| `authLimiter` | `<ip>:<username>` composite | On `POST /auth/login` |
| `passwordLimiter` | `user:<id>`, falling back to `ip:<ip>` | After `authMiddleWare` on `PATCH /auth/updatepassword` |

All three use a 15-minute window. The composite key generator is hardened against type confusion (a non-string `username` becomes `"unknown"` rather than throwing), truncates to 64 characters, normalizes case, and uses `ipKeyGenerator` for correct IPv6 handling. `skipSuccessfulRequests` is set on the two credential limiters so only failures consume budget, and every limiter is disabled when `NODE_ENV === "test"`.

Rejections are routed through `next(new AppError(..., 429))` rather than sent directly, so a `429` gets the same envelope and the same `requestId` as any other error.

### Refresh Token Rotation and Reuse Detection

- Tokens are stored as SHA-256 hashes (not bcrypt — these are high-entropy values, not passwords)
- Every refresh rotates the token; the old one is soft-deleted
- Presenting an already-rotated token means one of two parties is an attacker — **the collision itself is the evidence**, without needing to know which one — and the entire token family is revoked
- A 15-second grace window handles legitimate races: within it, a new access token is issued without rotating
- The refresh token carries no `role`, only `id` and `token_version`. A role baked into a 7-day token would outlive a role change by up to a week; the role is read from the database at issue time instead
- `logout` revokes selectively; `token_version` exists as the blunt, revoke-everything instrument

### Access Control

Three gates, checked separately:

1. **Function level** — is this role allowed to call this endpoint? (`authorize("admin", "editor")`)
2. **Object level** — does this user own this specific record? (IDOR / Broken Object Level Authorization)
3. **Field level** — is this user allowed to write *this field*?

The rule: **subject comes from the token, object comes from the request.** An identifier arriving in the request isn't dangerous by itself — it just requires justification, either ownership or role.

### SQL Injection

All values are passed as query parameters. The protection is mechanical: the value arrives *after* the query plan is built, so it can never be parsed as SQL.

Identifiers (column and table names) cannot be parameterized. Dynamic updates therefore build column lists from a **hardcoded allow-list**, iterating the allow-list rather than the user's keys.

### Input Validation

Zod schemas on every write route, applied through `middleware/validate.ts`, with `.strict()` to reject unknown keys, `.refine()` for cross-field rules, and `z.coerce` for type conversion at the edge.

### Headers and CORS

Helmet is mounted first in [`app.ts`](app.ts), so headers are present on **every** response including `429` and `404`. CORS uses an environment-driven allow-list and restricts methods to `GET`, `POST`, `PATCH`, `DELETE` and headers to `Content-Type`, `Authorization`. CORS is understood as the exception to the same-origin policy, not as a protection in itself — it opens a measured hole rather than closing one.

The JSON body parser is capped at `10kb`.

### Output Encoding

The architectural decision is **sanitize on output, not on input**. Encoding is a property of *how* data is displayed, not of the data itself. Where user content can reach an execution sink (`href`, `src`), an allow-list is the defense — encoding alone is not.

### OWASP Top 10 Coverage

| | Category | Status |
|---|---|---|
| A01 | Broken Access Control | ✅ |
| A02 | Cryptographic Failures | ⚠️ HTTPS pending deployment |
| A03 | Injection | ✅ |
| A04 | Insecure Design | ✅ |
| A05 | Security Misconfiguration | ✅ |
| A06 | Vulnerable Components | ✅ |
| A07 | Auth Failures | ✅ |
| A08 | Data Integrity Failures | ✅ |
| A09 | Logging & Monitoring | 🟡 Phase 1 done — see [Roadmap](#roadmap) |
| A10 | SSRF | N/A — no outbound user-controlled requests |

---

## Observability

### Request ID

[`middleware/requestId.ts`](middleware/requestId.ts) generates a `randomUUID` for every request, mounted before the rate limiter so even a throttled request is traceable. It is written to `res.locals.requestId` and returned as the `X-Request-Id` header — on **successful responses too**, so it works for general tracing rather than error reports alone.

### Structured Logging

[`utils/logger.ts`](utils/logger.ts) writes one JSON object per line to **stderr** (not stdout, so process managers can separate error streams). One line per event, newline-delimited — the format indexing tools expect.

The accepted fields are a fixed TypeScript type (`LogFields`) rather than a loose record. This makes the field allow-list **compiler-enforced**: passing a sensitive field is a build error, not something caught in review.

```json
{
  "time": "2026-08-31T08:50:25.725Z",
  "requestId": "27501b8d-4765-4a98-93d7-01dcbfc8ede6",
  "method": "GET",
  "path": "/articles/article/1",
  "statusCode": 500,
  "message": "boom",
  "stack": "Error: boom\n    at ..."
}
```

A missing `userId` is information, not an omission: it means the request failed before reaching `authMiddleWare`.

### Two Audiences, One Event

[`middleware/errorHandler.ts`](middleware/errorHandler.ts) treats an error as a single event rendered twice:

```
error
  ├──→ client:  short message + requestId
  └──→ log:     full context + stack + requestId
```

Whether a message is replaced depends on **its origin**, not on `NODE_ENV`: an `AppError` message was written by us and is safe by definition; anything else is replaced with `"Something Wrong!"`. Tying this to an environment variable would make the guarantee depend on a string that can be missing or miscased — and the failure would be silent.

---

## Testing

```bash
npm test                # run the suite
npx jest --coverage     # with coverage report
```

Jest runs through `ts-jest`, with `jest.setup.ts` injecting test token secrets so `requireEnv` resolves without a real `.env`.

Current coverage:

- **`utils/token.test.ts`** — unit tests: token shape, embedded claims, rejection under a wrong secret, and the 15-minute access token expiry
- **`controllers/auth.controller.test.ts`** — integration tests through Supertest covering login, password change, logout scoping, and the full refresh path: valid rotation, reuse outside the grace window (403 + revoke all), a race inside the grace window (200, no rotation), an unknown token, a malformed token, and a stale `token_version`

The article routes have no test coverage yet.

Mocking is deliberately partial where the real implementation is the thing under test — for example, `hashToken` stays real in refresh token tests so the hashing path is actually exercised.

### Verification Practice

Two habits are worth keeping when working on this codebase:

**Demand raw output.** "It works" isn't a result. A raw response and the matching log line are.

**Counterfactual testing.** Remove the supposed cause and check whether the outcome flips. If it doesn't, the test proved nothing. A test that returns the expected result while never executing the code path under test is a common and quiet failure — check the stack trace to confirm which path actually ran, not just which URL was requested.

---

## Design Decisions

Recurring principles that shaped the code:

1. **Allow-list, never filter.** Start from the permitted set, not from the user's input.
2. **The database is more trustworthy than the payload.** Log and act on what you found, not what was sent.
3. **Defense in depth.** Any unit that reads raw input defends itself — including the logger.
4. **Fail-safe.** Analyze both failure directions; one is usually catastrophic.
5. **Single source of truth.** A decision duplicated by copy-paste is a decision that will be forgotten.
6. **Order is part of the protection.** Cheapest check first, not "limiter first".
7. **Silent failure is worse than a crash.** A plausible response from the wrong source is the hardest bug to see.
8. **Vulnerabilities come from inconsistency, not ignorance.**

---

## Roadmap

**Observability (in progress)**
- [ ] Log levels; auth failure events with IP and existence flag rather than raw username
- [ ] Rate-based alerting — the level describes the event, the rate describes the situation
- [ ] Log rotation and retention
- [ ] Environment-aware log formatting (pretty in dev, JSON in prod)

**Deployment**
- [ ] HTTPS via Nginx reverse proxy, with correct `trust proxy` configuration
- [ ] Docker
- [ ] PM2 process management
- [ ] CI: automated tests and `npm audit`

**Infrastructure**
- [ ] Redis — shared rate limit store, caching
- [ ] Background jobs (BullMQ), including scheduled cleanup of expired refresh tokens

**Refactors**
- [ ] Move `BCRYPT_ROUNDS` and token lifetimes to environment configuration
- [ ] Extract the duplicated ownership check into a single helper
- [ ] Unify article route paths
- [ ] Service layer

**Testing**
- [ ] Integration tests for the article routes
- [ ] `test:coverage` npm script with a coverage threshold

**Documentation**
- [ ] Commit the SQL schema (`schema.sql`) so the database is reproducible
- [ ] OpenAPI / Swagger specification
