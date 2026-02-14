# FRY DAO Agent Field Guide

Use this document as the fast-loading mental model for anyone (human or AI) that needs to reason about the FRY Foundation DAO stack without re-reading the entire codebase.

## Snapshot

- **Primary app (`DAO/`)**: Next.js 16 (Pages router) with Tremor UI, Defly/Pera wallet connectors, and MongoDB-backed APIs for voting, staking, and withdrawals.
- **Support worker (`DAO_expire/`)**: Headless Node script that runs every minute and flips `current` to `false` when a vote’s `end_date` has passed so the web app stops showing it as active.

## Critical data

| Collection | Purpose | Key fields |
| --- | --- | --- |
| `dao` / `test-dao` | Vote documents consumed by `/vote`, `/lastvote`, `/allvotes`. | `title`, `description` (Markdown), `end_date`, `current`, `super_majority`, `hidden`, `votes[]` with `{ option, title, description, votes, different_people[] }`. |
| `dao-stakes` / `test-dao-stakes` | Tracks how many tokens each wallet burned per option and enforces the withdrawal cooldown. | `voteTitle`, `voteOption`, `address`, `assetId`, `stakes`, `votes`, `end_date`, `withdraw`. |
| `prices` | Configures how many tokens are needed per vote. | `project_name="Vote"`, `price`, `asset_id`, `isUSD`. |

> All collections live inside the `main` database pointed to by `MONGO_URI`.

## Environment checklist

- `MONGO_URI` — **required** everywhere.
- `NEXT_PUBLIC_TEST` — toggles test collections and shortens stake lock to 1 day.
- `VOTE_WALLET_SECRET` — mnemonic used by `/api/withdraw-stake` to return tokens (only set on the server/worker). Keep off the client!
- `MONGO_CA_CERT_PATH` — container path for Mongo TLS CA certificate (`/etc/ssl/mongo/mongo-ca.crt`).
- `OP_SERVICE_ACCOUNT_TOKEN` — supplied at runtime through Docker secret file `/run/secrets/op_service_account_token` for `op run`.

## Core flows

1. Wallet connects via `@txnlab/use-wallet` (Defly and Pera active in runtime).
2. User burns FRY (or configured ASA) to `BURN_ADDRESS = CM3F…NKYYM`, storing option index in the txn note.
3. `/api/new-vote` verifies the transaction through Algonode, updates the vote document and inserts/updates the stake.
4. Stakes remain locked until `end_date + 6 months` (or +1 day in test mode). `/api/get-stakes` just reads documents; `/api/withdraw-stake` flips `withdraw=true` and sends tokens back using `VOTE_WALLET_SECRET`.
5. `DAO_expire` ensures `current=false` after `end_date` so votes move to the historical views.

## Commands

```bash
# UI
cd DAO
npm install
npm run dev

# Vote expiry worker
cd DAO_expire
npm install
npm run start   # polling every 60s

# Production containers (from DAO/)
docker compose build
docker compose up -d
docker compose logs -f dao dao_expire
```

## Implementation clues

- Mongo connections live in `lib/mongoclient.ts` (MongoDB driver) and `lib/connect.ts` (Mongoose) for different parts of the app.
- Wallet integration uses `@txnlab/use-wallet@4` through a local adapter in `lib/use-wallet-compat.tsx` to preserve the app's legacy hook/provider usage.
- `next.config.js` includes `webpackFallback` from `@txnlab/use-wallet` so optional wallet packages do not fail builds.
- Algorand integration targets `algosdk@3` field names and response shapes (for example `sender`/`receiver`, `confirmedRound`, `txid`).
- Markdown rendering happens server-side (`marked`) and is sanitized through `lib/sanitize-html.ts`.
- Vestige Labs API supplies asset prices when `prices.isUSD` is true; the code caches the latest response for 1 minute.
- Stake withdrawal timers are computed on the client each second (`components/stake.tsx`) to show live countdowns.

Keep this guide around to short-circuit future context building; defer to `README.md` when deeper background is needed.
