# TRAINING.md

This repository is a **training project**, not a product. Nothing here is meant
to ship, acquire users, or be maintained for its own sake. Its only purpose is
to be a realistic enough backend that real decisions have to be made in it —
and then to make those decisions deliberately, with reasons written down.

The blog domain (users, articles) is intentionally boring. The domain is the
excuse; the engineering is the subject.

## What I am training

### 1. Backend fundamentals

Not "can I make an endpoint return 200", but:

- Where logic belongs — controller, model, middleware, or utility — and why a
  thing that looks like one concept should be named and called as one concept
  (`rotate`, `assertCanModify`) instead of two calls a caller can forget half of.
- Transactions as a correctness tool: what must happen atomically and what
  must not (`rotate`, `revokeAllForUser`, `updatePasswordTx`).
- Parameterized queries, typed rows, and one source of truth per fact — e.g.
  a stored token row's expiry derived from the token's own `exp` claim, so the
  JWT and the database cannot drift apart.
- Errors as a designed surface: `AppError` + `catchAsync` + one error handler,
  and choosing status codes on purpose (401 vs 403 is a decision, not a coin flip).

### 2. Security, as the default posture

The auth flow here is the training ground, and it is built the way it is on
purpose:

- Passwords: bcrypt, plus a dummy compare on unknown usernames so the response
  time does not leak whether an account exists.
- Access tokens short-lived; refresh tokens long-lived, **stored server-side as
  SHA-256 fingerprints** so a database leak does not hand out sessions. (SHA-256
  and not bcrypt — the token is already high-entropy; bcrypt buys nothing and
  costs a lot per request.)
- **Rotation:** one refresh token is used exactly once; using it mints its
  replacement and kills it in the same transaction.
- **Reuse detection:** a signature-valid token the store never issued, or one
  rotated away long ago, means a copy is circulating — every session for that
  user is burned rather than served.
- **A grace window** for the one case reuse detection gets wrong: a client that
  legitimately fires two refreshes at once. The loser of that race is served
  without a second rotation. This is a deliberate trade — a short window in
  which a stolen token also passes — and the point of the exercise is that the
  trade was chosen, sized, and commented, not stumbled into.
- Least privilege in token payloads: a refresh token carries an id and a
  `token_version`, and no role — a role baked into a 7-day token outlives a
  role change by 7 days. The role is read from the database at issue time.
- `token_version` as a global kill switch, bumped on password change and on
  full logout, so outstanding access tokens die too.
- Defense at the edges, not just in handlers: `helmet`, an explicit CORS
  allowlist, a JSON body cap, a general rate limiter, and login/password
  limiters keyed on IP+username and on user id — with the ordering constraint
  written down where it matters (a limiter keyed on `req.user` must be mounted
  after the auth middleware).
- Input validated at the boundary with zod schemas, so handlers can assume
  shape.

The habit being trained: for each feature, ask _how is this abused_ before
asking _how do I finish this_.

### 3. Real production architecture

The parts of "production" that are easy to skip in a tutorial are exactly the
parts I want reps in:

- Layering that survives growth: `routes/` → `middleware/` → `controllers/` →
  `models/`, with `config/`, `utils/`, and `validators/` as leaves. No layer
  reaching backwards.
- Config that fails loudly: `requireEnv` at startup instead of `undefined`
  leaking into a JWT secret.
- Tests that assert behavior at the HTTP boundary (supertest) with the database
  mocked at the model seam — including the failure paths, which is where the
  security decisions actually live.
- Typed end to end, with `tsc --noEmit`, `eslint`, and `prettier` treated as
  part of "done" rather than optional cleanup.
- Knowing what is still missing and saying so out loud, rather than pretending
  the project is complete: schema migrations for `refresh_tokens` (the DDL is
  not in the repo yet), structured logging, request ids, CI, a scheduled job to
  call `deleteExpired`, and observability of any kind.

### 4. Being AI-aware

I use an AI assistant on this project on purpose, and how I use it is itself
part of the training:

- Reading generated code as a reviewer, not a consumer. Every non-obvious line
  should have a reason I can state without looking it up.
- Directing the design myself: the decisions above (rotation as one named
  operation, the grace window, dropping `role` from the refresh payload) came
  from arguing about the design, not from accepting the first working diff.
- Asking for the trade-off and the failure mode, not just the implementation —
  and expecting the second-order consequence to be surfaced (e.g. that a grace
  window keyed on `revoked_at` cannot tell "rotated" from "logged out", which
  delays single-session logout by the width of the window).
- Treating confident output as a hypothesis. Typecheck, tests, and lint run
  before I believe anything; when a test had to change to keep passing, I want
  to know whether the code got better or the test got weaker.
- Keeping the reasoning in the repo — comments explain _why_, so the next reader
  (me, in three months) inherits the decision and not just the syntax.

## How I want work on this repo to go

- Explain the _why_ before the diff; a design disagreement is more valuable than
  a fast implementation.
- Name the trade-off and the attack it opens or closes.
- Point out what my instruction breaks — types, tests, other callers — instead
  of silently patching around it.
- No silent scope changes, and no "done" that has not been typechecked, tested,
  and linted.
- If something is left undone, say what and why, plainly.

## Status

Working: signup, login, logout (single session and all sessions), refresh with
rotation + reuse detection + grace window, password change, article CRUD with
role checks, rate limiting, validation, error handling, and a test suite over
the auth surface.

Explicitly not done yet: migrations for the `refresh_tokens` table, logging,
CI, and a cleanup job for expired tokens. See the list in section 3.
