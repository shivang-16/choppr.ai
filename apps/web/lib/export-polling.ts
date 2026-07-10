/** How often the UI polls GET /api/exports/:id (was 2.5s, now 5s). */
export const EXPORT_POLL_INTERVAL_MS = 5_000;

/** Stop polling and show timeout if export isn't done after this (25 min). */
export const EXPORT_TIMEOUT_MS = 25 * 60 * 1000;

export const EXPORT_TIMEOUT_MINUTES = EXPORT_TIMEOUT_MS / 60_000;
