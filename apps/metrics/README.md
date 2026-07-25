# Choppr Metrics

Self-contained internal metrics dashboard. Talks to MongoDB directly — no dependency on the main Choppr API.

## Env (`apps/metrics/.env.local`)

```
CHOPPR_DB=mongodb+srv://...
METRICS_USERNAME=admin
METRICS_PASSWORD=choppr-metrics
```

## Run

```bash
pnpm --filter metrics dev
```

Open [http://localhost:3001](http://localhost:3001), sign in — metrics load automatically. Use **Refresh** to reload.

## Date range

Global filter in the header (default **Last 7 days**). Presets: Today, 7 / 30 / 90 days, All time, or custom from/to.

Scopes overview activity, daily breakdown, leaderboards, sales activity maps, people activity ranks, and free-plan overages. Plan/subscription stock chips stay all-time.

## Scale notes

- Overview uses counts / `$group` only (no full document dumps)
- Leaderboards are top **50** (ranked in maps, then hydrate those IDs only)
- Sales leads are built with a **batched cursor** (250 users at a time); UI pages **25** at a time
- Refresh hits `/api/snapshot` once (aggregates computed once, not 3×)
- Sales pagination reuses a short in-memory cache (~2 min) so Next/Prev stays cheap

## Free plan overages tab

Lists free-plan projects (and a per-user rollup) that exceed video length limits:

| Limit | Value |
|-------|-------|
| Current free | **30 min** / **150 credits** |
| Previous free (legacy) | **45 min** / **250 credits** |

- **Soft** — duration &gt; 30 min but ≤ 45 min (bypasses current free only)
- **Hard** — duration &gt; 45 min (past the old free ceiling)

Includes source URL, estimated job credits, status, and user contact. API: `GET /api/bypass`.

## Sales tab (“Who to message”)

Segments users for outreach with a suggested message each:

| Segment | Signal | Goal |
|---------|--------|------|
| Stuck / failures | Many failed projects | Support / save |
| Upgrade ready | Heavy free usage | Convert to paid |
| Low credits | Near zero balance | Top-up / plan |
| Top-up → plan | Buying top-ups on free | Cheaper plan upsell |
| Never exported | Has clips, 0 exports | Activation |
| Churn risk | Was active, idle 14d+ | Win-back |
| New & active | Joined ≤7d, already clipping | White-glove |
| Never started | Signed up, 0 projects | Onboarding |
| Paid champion | Paid + high usage | Referral / case study |
