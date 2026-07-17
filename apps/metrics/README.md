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
