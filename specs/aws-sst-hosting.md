# AWS + SST hosting plan

## Scope

- Target **production architecture only**.
- Use **SST** to manage the deployment.
- Rewrite the prior plan as a **pure AWS** target.
- **Do not** plan observability in this document.
- Treat **PlanetScale Postgres** as a fixed input.
- Remove **Hyperdrive** from the target architecture.

## Fixed constraints

- **Database:** PlanetScale Postgres.
- **No Hyperdrive** in the target plan.
- **Public edge is AWS-only**.
- Current app shape remains:
  - static web frontend
  - API server
  - Zero sync tier

## Decision

### Recommended target

- **Web:** `sst.aws.StaticSite`
- **API:** **AWS Lambda + API Gateway v2**
- **Zero:** **AWS ECS/Fargate** using the same deployment shape Rocicorp documents in their SST example

## Why this is the right AWS target

### Web

The web app is a Vite SPA. `sst.aws.StaticSite` is the right fit because:

- it is the AWS-native SST component for static sites
- it handles build + deploy cleanly
- it uses S3 + CloudFront under the hood
- it is a direct replacement for the current static host

### API

Lambda + API Gateway is the right AWS choice for this repo because:

- the current API is still fundamentally a **Node app**
- most of the request handling already uses web-style `Request` / `Response` semantics through Effect HTTP
- the main hard Node coupling is concentrated in the current server bootstrap
- Lambda preserves the Node runtime instead of forcing an edge-runtime rewrite

So for this repo, Lambda is the lower-risk AWS target than trying to containerize the API immediately.

### Zero

Zero remains the stateful exception.

The correct AWS shape is the one Rocicorp already documents:

- **1 replication-manager**
- **N view-syncers**
- sticky websocket balancing
- local SQLite replica files
- litestream backup to S3

That is already close to the current self-hosted Zero topology in this repo.

## Public hostnames

Keep the current public host split:

- `chevrotain.schmatzler.com` -> web
- `api.chevrotain.schmatzler.com` -> API
- `sync.chevrotain.schmatzler.com` -> Zero sync tier

Why keep it:

- matches the current app/env shape already in the repo
- keeps websocket traffic isolated from normal API traffic
- minimizes frontend/env churn

## DNS and certificates

Use AWS-native edge/DNS ownership:

- **Route 53** hosted zone for the domain
- **ACM** certificates for:
  - apex / web domain
  - `api` domain
  - `sync` domain

Routing target by hostname:

- apex -> CloudFront distribution created by `sst.aws.StaticSite`
- `api` -> API Gateway custom domain
- `sync` -> public ALB in front of Zero view-syncers

## Target architecture

```text
Browser
  -> https://chevrotain.schmatzler.com      -> CloudFront -> S3 static site
  -> https://api.chevrotain.schmatzler.com  -> API Gateway -> Lambda
  -> wss://sync.chevrotain.schmatzler.com   -> ALB -> Zero view-syncers

API Lambda
  -> PlanetScale Postgres (pooled connection string)

Zero replication-manager
  -> PlanetScale Postgres (direct connection string for upstream replication)
  -> PlanetScale Postgres (pooled connection string for CVR / Change DB)
  -> S3 replica backup via litestream

Zero view-syncers
  -> replication-manager internal URL
  -> https://api.chevrotain.schmatzler.com/api/query
  -> https://api.chevrotain.schmatzler.com/api/mutate
```

## SST shape

Use a **single AWS SST app**.

### App configuration

- set SST `home` to **AWS**
- use one `sst.config.ts` to own:
  - web
  - API
  - Zero
  - DNS / domains
  - secrets

This keeps the infrastructure description in one place and avoids splitting app ownership across tools.

## Web target

### Component

Deploy the frontend with `sst.aws.StaticSite`.

Recommended shape:

- `path` -> `apps/web`
- build command -> the repo's web build command
- output -> the built Vite assets
- domain -> `chevrotain.schmatzler.com`
- set browser build env for:
  - `VITE_BASE_URL`
  - `VITE_API_URL`
  - `VITE_SYNC_URL`

### Under the hood

`sst.aws.StaticSite` will use:

- S3 for assets
- CloudFront for delivery

That is fine; the plan does not need to care about the lower-level split beyond cache and domain behavior.

### Web-specific notes

- keep SPA routing behavior intact
- preserve current root-domain hosting model
- preserve current `VITE_SYNC_URL` dedicated sync origin

## API target

### Components

Deploy the API as:

- one `sst.aws.Function` for the main API runtime
- one `sst.aws.ApiGatewayV2` in front of it
- custom domain `api.chevrotain.schmatzler.com`

### API routing shape

Use a single catch-all Lambda-backed API rather than splitting each route into separate functions.

Why:

- the current API is built as one HTTP service
- the handler graph, middleware, auth, and metrics are already composed centrally
- it minimizes repo churn versus decomposing into many Lambda functions

### Runtime recommendation

Keep the API Lambda **outside a VPC** unless a hard requirement appears.

Why:

- PlanetScale is an external managed database
- the API does not need private AWS network access to reach it
- keeping Lambda out of a VPC avoids needless cold-start/network complexity

### Database connection path

For the API Lambda, use a **pooled PlanetScale Postgres connection string**.

Do not use:

- Hyperdrive
- Zero's replication upstream connection string

### Current repo implication

The current API is not a no-op lift-and-shift, but the change is bounded.

Expected adaptation:

- replace `apps/api/src/server.ts` with a Lambda bootstrap
- keep the main handler graph from `apps/api/src/index.ts`
- preserve the existing Node-based libraries where possible

This is materially less invasive than rewriting the API for a Worker runtime.

## Zero target

### Deployment shape

Use the same SST/AWS shape Rocicorp documents:

- VPC
- ECS cluster
- S3 bucket for replica backup
- one Fargate service for **replication-manager**
- one Fargate service for **view-syncers**

### Topology

Match the current deployment shape to start:

- **1 replication-manager**
- **2 view-syncers**

The repo already runs two view-syncers today, so the first AWS deployment should not collapse that down.

### Load balancing

Place a **public ALB** in front of the view-syncers with:

- websocket support
- health check on `/keepalive`
- sticky sessions enabled

Sticky sessions matter because Zero benefits from reconnecting clients landing on a warm view-syncer.

### Region placement

Run Zero in the AWS region nearest the PlanetScale Postgres primary.

For Zero, regional database proximity matters more than edge presence.

## Zero runtime configuration

### Replication-manager

Use the replication-manager as the only logical replication owner.

Key settings:

- `ZERO_APP_ID=chevrotain`
- `ZERO_NUM_SYNC_WORKERS=0`
- `ZERO_REPLICA_FILE=/data/replica.db`
- `ZERO_LITESTREAM_BACKUP_URL=s3://...`
- `ZERO_ADMIN_PASSWORD=<secret>`
- `ZERO_UPSTREAM_DB=<direct PlanetScale Postgres URL>`
- `ZERO_CVR_DB=<pooled PlanetScale Postgres URL>`
- `ZERO_CHANGE_DB=<pooled PlanetScale Postgres URL>`
- `ZERO_APP_PUBLICATIONS=<explicit publication name>`

### View-syncers

Key settings:

- `ZERO_APP_ID=chevrotain`
- `ZERO_REPLICA_FILE=/data/replica.db`
- `ZERO_CHANGE_STREAMER_URI=<replication-manager internal URL>`
- `ZERO_QUERY_URL=https://api.chevrotain.schmatzler.com/api/query`
- `ZERO_MUTATE_URL=https://api.chevrotain.schmatzler.com/api/mutate`
- `ZERO_QUERY_FORWARD_COOKIES=true`
- `ZERO_MUTATE_FORWARD_COOKIES=true`
- `ZERO_ADMIN_PASSWORD=<secret>`

### Start from the current tuning

The current self-hosted config already has non-default Zero tuning. Start from that shape in AWS:

- `ZERO_NUM_SYNC_WORKERS=2` on each view-syncer
- `ZERO_CVR_MAX_CONNS=8`
- `ZERO_CHANGE_MAX_CONNS=2`
- `ZERO_INITIAL_SYNC_TABLE_COPY_WORKERS=2` on the replication-manager

This preserves the repo's current concurrency assumptions better than resetting to library defaults.

## PlanetScale Postgres requirements

This is the most important DB-specific section.

The target remains **PlanetScale Postgres**.

### Required validation items

1. **Logical replication must be supported and enabled** for Zero's upstream connection.
2. **Connection budget must be raised** enough for Zero's pools plus the API.
3. **Explicit publication management is required**.

### Publication requirement

Zero's docs call out a PlanetScale Postgres limitation:

- PlanetScale Postgres does **not** support creating a publication with `FOR ALL TABLES`
- Zero should therefore **not** rely on its default publication creation behavior
- production should use an explicitly managed publication and set `ZERO_APP_PUBLICATIONS` to that publication name

That publication setup is a **manual database prerequisite**. It should not be generated from this repo.

### Connection-string split

Use the database in three distinct ways:

- **API Lambda** -> **pooled** PlanetScale Postgres URL
- **Zero `ZERO_UPSTREAM_DB`** -> **direct** PlanetScale Postgres URL
- **Zero `ZERO_CVR_DB` / `ZERO_CHANGE_DB`** -> **pooled** PlanetScale Postgres URLs

Do not blur these roles together.

## Repo-facing implications

### Web

- `apps/web` stays a Vite app
- deployment target becomes `sst.aws.StaticSite`
- keep:
  - `VITE_BASE_URL`
  - `VITE_API_URL`
  - `VITE_SYNC_URL`

### API

The API becomes a Lambda-hosted Node service instead of a long-running Node server.

Expected work:

- replace the `node:http` bootstrap in `apps/api/src/server.ts`
- add a Lambda adapter entrypoint
- keep the existing composed handler graph where possible
- keep direct Node library usage for DB, auth, mail, and telemetry where practical

This is an adaptation of the runtime boundary, not a full API redesign.

### Zero

- keep the dedicated sync endpoint model
- keep websocket sync on `sync.<domain>`
- continue forwarding cookies from Zero to API query/mutate endpoints

## Secrets and environment ownership

### Web build env

The StaticSite build should receive:

- `VITE_BASE_URL`
- `VITE_API_URL`
- `VITE_SYNC_URL`

### API Lambda env

The API Lambda needs the current app secrets/config, excluding observability for now:

- `BASE_URL`
- `AUTH_BASE_URL`
- `DATABASE_URL` = pooled PlanetScale Postgres URL for the API
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `POLAR_ACCESS_TOKEN`
- `POLAR_SERVER`
- `POLAR_SUCCESS_URL`
- `POLAR_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `GMAIL_PUBSUB_TOPIC`
- `GMAIL_OAUTH_CLIENT_ID`
- `GMAIL_OAUTH_CLIENT_SECRET`
- `GMAIL_OAUTH_REDIRECT_URI`
- `MAIL_KEK`

### Zero env

The Zero services need:

- `ZERO_ADMIN_PASSWORD`
- `ZERO_APP_ID`
- `ZERO_UPSTREAM_DB`
- `ZERO_CVR_DB`
- `ZERO_CHANGE_DB`
- `ZERO_APP_PUBLICATIONS`
- `ZERO_QUERY_URL`
- `ZERO_MUTATE_URL`
- `ZERO_QUERY_FORWARD_COOKIES`
- `ZERO_MUTATE_FORWARD_COOKIES`
- `ZERO_LITESTREAM_BACKUP_URL`

### Recommendation

Store all deployment secrets under SST-managed secret handling and inject them into:

- StaticSite build env
- Lambda
- ECS/Fargate services

This replaces the current host-local `sops` environment-file setup for the app hosts.

## Rollout plan

### Phase 1: AWS prerequisites

1. Create / migrate the Route 53 hosted zone.
2. Provision ACM certificates for web, API, and sync hostnames.
3. Prepare SST-managed secrets.
4. Prepare PlanetScale Postgres prerequisites:
   - direct URL for Zero upstream
   - pooled URL for API
   - pooled URLs for Zero CVR / Change DB
   - explicit publication for Zero

### Phase 2: Web

1. Deploy `sst.aws.StaticSite` without switching traffic.
2. Verify SPA routing and asset caching.
3. Verify `VITE_API_URL` and `VITE_SYNC_URL` wiring.

### Phase 3: API

1. Deploy API Gateway + Lambda under the final `api` hostname.
2. Verify:
   - auth flows
   - Polar webhook handling
   - Gmail OAuth callback handling
   - Gmail Pub/Sub webhook ingestion
   - Zero query/mutate endpoints
3. Verify database behavior against the pooled PlanetScale URL.

### Phase 4: Zero

1. Deploy the Fargate VPC / cluster / bucket.
2. Deploy replication-manager.
3. Deploy view-syncers behind the ALB.
4. Verify:
   - `/keepalive`
   - websocket connectivity
   - sticky reconnect behavior
   - Zero query/mutate callbacks to the API hostname
   - replica backup/restore behavior to S3

### Phase 5: Cutover

1. Switch Route 53 records to the AWS targets.
2. Verify end-to-end login and app boot.
3. Verify Zero reconnect / sync traffic.
4. Leave the old self-hosted platform running briefly during rollback window.
5. Retire the self-hosted app hosts after the window closes.

## What this retires

This plan retires the current self-hosted app hosts:

- `chevrotain-web`
- `chevrotain-zero`

The old self-hosted Postgres host remains superseded by the PlanetScale decision.

## Final recommendation

Build the production architecture as:

- **AWS Route 53 + ACM** for DNS/certificates
- **`sst.aws.StaticSite`** for web
- **API Gateway v2 + Lambda** for API
- **ECS/Fargate + ALB + S3** for Zero
- **PlanetScale Postgres** as the fixed database backend
- **no Hyperdrive**

This gives you a coherent AWS-only deployment model, keeps the current host split intact, fits the repo's existing Node API better than a Worker migration, and uses Zero's documented SST/AWS deployment shape for the stateful sync tier.
