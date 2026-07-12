# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into Choppr. Client-side tracking is initialized via `instrumentation-client.ts` (Next.js 15.3+ pattern), routing through a reverse proxy configured in `next.config.js` to avoid ad blockers. User identity is synced from Clerk on every page load via `PostHogIdentify`. Eleven business events are instrumented across the core video clipping workflow — from video ingestion through AI job creation, editor export, and billing conversions. A server-side PostHog client is available in `lib/posthog-server.ts` for future API route instrumentation.

| Event | Description | File |
|---|---|---|
| `video_url_submitted` | User submits a video URL to the dashboard for processing | `app/(root)/dashboard/_components/dashboard-client.tsx` |
| `file_upload_started` | User begins uploading a local video file | `app/(root)/dashboard/_components/dashboard-client.tsx` |
| `file_upload_completed` | User's local video file was successfully uploaded to S3 | `app/(root)/dashboard/_components/dashboard-client.tsx` |
| `job_created` | User creates an AI clipping job from a video URL or uploaded file | `app/(root)/dashboard/_components/dashboard-client.tsx` |
| `full_video_edit_started` | User starts a full-video edit job (transcribe-only, no AI clipping) | `app/(root)/dashboard/_components/dashboard-client.tsx` |
| `export_started` | User initiates a video export from the editor | `app/(root)/dashboard/editor/[projectId]/_components/export-modal.tsx` |
| `export_completed` | Video export finished successfully and download link is available | `app/(root)/dashboard/editor/[projectId]/_components/export-modal.tsx` |
| `export_cancelled` | User cancelled an in-progress video export | `app/(root)/dashboard/editor/[projectId]/_components/export-modal.tsx` |
| `project_deleted` | User confirmed deletion of a project and all its clips | `app/(root)/dashboard/projects/page.tsx` |
| `plan_upgrade_initiated` | User clicked to upgrade to a paid plan, redirecting to checkout | `app/(root)/dashboard/billing/page.tsx` |
| `topup_checkout_initiated` | User initiated a one-time credit top-up checkout | `app/(root)/dashboard/billing/page.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) dashboard](https://us.posthog.com/project/508554/dashboard/1835240)
- [Job creation funnel](https://us.posthog.com/project/508554/insights/s9cgmyUl) — video URL submission → job creation conversion rate
- [Jobs created over time](https://us.posthog.com/project/508554/insights/0w0EfDSb) — daily job volume broken down by source (URL vs upload)
- [Export funnel](https://us.posthog.com/project/508554/insights/Sts4EoFW) — export started → export completed conversion rate
- [Plan upgrade attempts](https://us.posthog.com/project/508554/insights/63BAKhPO) — weekly plan upgrade and top-up checkout initiations
- [Video ingestion methods](https://us.posthog.com/project/508554/insights/YsCgbFeo) — URL submissions vs file uploads over time

## Verify before merging

- [ ] Run a full production build (`pnpm build`) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` to `.env.example` and any monorepo bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.
- [ ] Confirm the returning-visitor path also calls `identify` — `PostHogIdentify` runs on every page load via `Providers`, so returning sessions are covered as long as Clerk loads the user before the effect fires. Verify in the PostHog People view that returning users appear under the same distinct ID across sessions.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
