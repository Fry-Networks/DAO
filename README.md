
# FRY Foundation DAO Platform

This repository hosts two coordinated codebases:

- `DAO/` — a Next.js 16 web app (Pages router) that powers the FRY Foundation decentralized governance experience (wallet connection, active votes, historical votes, and staking/withdrawal flows).
- `DAO_expire/` — a lightweight Node.js worker that keeps the MongoDB vote state clean by turning finished proposals off.

Together they let Algorand wallet holders burn FRY tokens to vote, keep those tokens locked for a cooling‑off period, and later withdraw the stake once a proposal fully settles.

## How the system works

1. **Wallet connection (primary auth)**
   - Voters sign in by connecting Algorand wallets through `@txnlab/use-wallet` (Defly, Pera). Once a wallet is active the UI enables voting, staking, and withdrawals.

2. **Active votes**
   - Server-side rendered pages (`/vote`, `/lastvote`, `/allvotes`) fetch vote docs from MongoDB (`dao` or `test-dao` collections).
   - Markdown descriptions are rendered to HTML (via `marked` + DOMPurify) before being displayed.
   - Depending on the vote configuration, current tallies can stay hidden until the vote ends (`hidden: true`).

3. **Casting a vote**
   - Frontend component `components/vote.tsx` creates an Algorand ASA transfer to the burn wallet `CM3F…NKYYM`.
   - Each vote stores the selected option index in the transaction note so `/api/new-vote` can verify it on-chain. Accepted token defaults to FRY asset `2485314946` unless a custom price record is configured.
   - The API re-checks the transaction, calculates weighted votes (`aamt / 1e6 / priceValue`), updates the Mongo vote document, and writes/updates an entry in the `dao-stakes` collection.

4. **Staking and withdrawals**
   - Stakes lock the burned amount for six months (or one day in test mode). They are stored per wallet, vote, and ASA in `dao-stakes` (`test-dao-stakes` for test mode).
   - `/stake` fetches stakes via `/api/get-stakes` and renders countdown timers (`components/stake.tsx`).
   - `/api/withdraw-stake` double-checks ownership, enforces the cool-down, marks the stake as withdrawn, and sends the ASA back using the hot wallet defined by `VOTE_WALLET_SECRET`.

5. **Automatic vote expiry**
   - `DAO_expire/src/index.ts` runs every minute, connects to MongoDB, and flips `current` to `false` for any vote whose `end_date` passed. This keeps the front-end list of active votes accurate even if no one manually toggles them.

## Data model reference

All collections live in the `main` MongoDB database (see `lib/connect.ts`). Test mode (`NEXT_PUBLIC_TEST=true`) switches queries to the `test-*` collections but the schema is identical.

### Votes (`dao` / `test-dao`)

| field | type | purpose |
| --- | --- | --- |
| `title` | string | Public proposal title. |
| `description` | markdown string | Rendered into HTML for the proposal body. |
| `end_date` | ISO Date | Vote closing time (UTC). Also drives staking unlock windows. |
| `createdAt` | string | Creation timestamp. |
| `current` | boolean | Marks active votes. `DAO_expire` flips this to `false` after `end_date`. |
| `deleted` | boolean | Soft delete flag so past votes can be hidden without removing history. |
| `super_majority` | boolean | Requires >50% of total votes for any option to pass. UI highlights when unmet. |
| `hidden` | boolean (optional) | When true, the `/vote` page masks interim tallies. `/allvotes` still shows the final results once the vote is archived. |
| `total_votes` | number | Cached aggregated total. |
| `hadVotes` | boolean | Indicates if any weight has been cast yet (used to query “completed” votes). |
| `votes` | array | One entry per option: `{ option, title, description, votes, different_people[] }`. The `different_people` array stores unique wallet addresses for eligibility checks and wallet counts. |

### Stakes (`dao-stakes` / `test-dao-stakes`)

| field | type | purpose |
| --- | --- | --- |
| `voteTitle` | string | Denormalized link to the proposal title. |
| `voteOption` | string | Index of the chosen option. |
| `address` | string | Algorand wallet that cast the vote. |
| `assetId` | string | ASA identifier (defaults to FRY). |
| `votes` | number | Weighted votes credited to the wallet. |
| `stakes` | number | Raw token amount (in FRY) locked for the duration. |
| `end_date` | Date | Copied from the vote doc to compute unlock date. |
| `withdraw` | boolean | Set to true after `/api/withdraw-stake` sends tokens back. |

### Prices (`prices`)

Single-entry collection storing token conversion configuration for vote pricing.

| field | type | purpose |
| --- | --- | --- |
| `project_name` | string | Identifier (the app queries `Vote`). |
| `price` | number | Either token price or a multiplier (see below). |
| `asset_id` | string | Algorand asset to monitor. Defaults to FRY ASA when omitted. |
| `isUSD` | boolean | When true the backend fetches live USD prices from Vestige Labs for `asset_id` and derives the `priceValue` ratio; when false the `price` is treated as the direct ASA cost per vote. |

## API surface (Next.js routes)

| Route | Method | Description |
| --- | --- | --- |
| `/api/new-vote` | `PUT` | Verifies an Algorand transaction against the burn wallet, applies weighted votes, and records stakes. |
| `/api/get-stakes` | `PUT` | Returns every stake document for a wallet address so the UI can show lock timers. |
| `/api/withdraw-stake` | `PUT` | After cooldown, uses `VOTE_WALLET_SECRET` to transfer the staked ASA back to the caller and marks the stake as withdrawn. |

## Environment variables

| Variable | Used by | Notes |
| --- | --- | --- |
| `MONGO_URI` | All apps | Connection string to the MongoDB cluster (database `main`). Mandatory for both `DAO` and `DAO_expire`. |
| `NEXT_PUBLIC_TEST` | Front-end & APIs | When set to `true`, reads/writes from `test-dao` & `test-dao-stakes` collections and shortens stake lock duration to 1 day. |
| `VOTE_WALLET_SECRET` | `/api/withdraw-stake` | 25-word mnemonic for the FRY Foundation vote wallet that returns stakes. Guard carefully. |
| `MONGO_CA_CERT_PATH` | Docker runtime | Path to Mongo CA cert inside containers (`/etc/ssl/mongo/mongo-ca.crt`), mounted read-only from host. |
| `OP_SERVICE_ACCOUNT_TOKEN` | Docker runtime | Supplied through Docker secret file `/run/secrets/op_service_account_token`; used by `op run` in entrypoint. |
| `NODE_ENV` | Build tooling | Standard Next.js runtime flag. |

## Local development

1. Install dependencies for both projects:
   ```bash
   cd DAO && npm install
   cd ../DAO_expire && npm install
   ```
2. Provide the environment variables above (a `.env.local` for Next.js and `.env` for the worker work well; remember they are excluded from version control).
3. Run the Next.js app:
   ```bash
   cd DAO
   npm run dev
   ```
   Visit `http://localhost:3000`.
4. Run the vote-expiry worker (optional for dev, but useful to keep `current` flags accurate):
   ```bash
   cd DAO_expire
   npm run build   # transpiles TypeScript from src/ to build/
   npm run start
   ```

The main UI relies on MongoDB being available and Algorand network access for transaction verification and price feeds (`https://mainnet-api.algonode.cloud`, `https://api.vestigelabs.org`).

## Docker deployment

From `DAO/`:

```bash
# Build both services
docker compose build

# Start/recreate services
docker compose up -d

# Follow logs
docker compose logs -f dao dao_expire

# Rolling update
docker compose build --pull
docker compose up -d --force-recreate
```

## Operational notes

- **Wallet connectors**: Active providers are initialized in `pages/_app.tsx` and currently include Defly + Pera only.
- **Wallet API compatibility**: `@txnlab/use-wallet@4` removed the old React API. `lib/use-wallet-compat.tsx` provides the legacy hook/provider interface used by this app while running on v4.
- **Webpack wallet fallback**: `next.config.js` applies `webpackFallback` from `@txnlab/use-wallet` so optional providers (for example Web3Auth) do not break builds when not installed.
- **Algorand SDK v3 migration**: API routes and vote signing use the v3 field names (`sender`/`receiver`, `confirmedRound`, `txid`, typed transaction fields) instead of legacy dashed keys.
- **Middleware**: `app/middleware.ts` ensures MongoDB connectivity before serving pages.
- **Price caching**: `pages/vote.tsx` caches FRY and ALGO prices in-memory with 1-minute TTL to reduce Vestige API calls.
- **Security**: Never ship the mnemonic (`VOTE_WALLET_SECRET`) to the browser. Sensitive env values are injected at runtime via `op run`.
- **Scaling**: MongoDB queries rely on collection-wide scans. Adding indexes on `{ current: 1 }`, `{ address: 1 }`, and `{ end_date: -1 }` is recommended for production traffic.
- **Container deployment**: `docker-compose.yml` runs both `dao` and `dao_expire` with non-root runtime, read-only FS, dropped Linux capabilities, and runtime 1Password injection.
- **Dependency override**: `package.json` pins `overrides.sucrase.glob=13.0.3` to avoid deprecated vulnerable transitive `glob` versions pulled through Tailwind/Sucrase.

Refer to `AGENTS.md` for a concise, agent-friendly cheat sheet once you are familiar with the broader context.
