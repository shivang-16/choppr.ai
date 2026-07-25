import { useCallback } from "react";
import { useAuth } from "@clerk/nextjs";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Authenticated fetch for the Choppr API.
 * After signup, the dashboard fires many parallel requests while Clerk's token
 * and our user-create path settle — retry getToken briefly and once on 401.
 */
export function useApiFetch() {
  const { getToken } = useAuth();

  return useCallback(async (input: string, init: RequestInit = {}): Promise<Response> => {
    let token = await getToken();

    // Brief retry — token often arrives just after signup redirect
    if (!token) {
      for (let i = 0; i < 8 && !token; i++) {
        await sleep(150);
        token = await getToken();
      }
    }

    const buildHeaders = (authToken: string | null): HeadersInit => ({
      ...(init.headers ?? {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      "Cache-Control": "no-store",
      ...(init.body && !(init.headers as Record<string, string> | undefined)?.["Content-Type"]
        ? { "Content-Type": "application/json" }
        : {}),
    });

    const res = await fetch(input, {
      ...init,
      cache: "no-store",
      headers: buildHeaders(token),
    });

    // Retry once on 401: signup race (parallel user create) or stale token
    if (res.status === 401 && token) {
      await sleep(300);
      let fresh: string | null = null;
      try {
        fresh = await getToken({ skipCache: true });
      } catch {
        fresh = await getToken();
      }
      return fetch(input, {
        ...init,
        cache: "no-store",
        headers: buildHeaders(fresh || token),
      });
    }

    return res;
  }, [getToken]);
}
