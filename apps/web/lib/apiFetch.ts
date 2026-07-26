import { useCallback } from "react";
import { useAuth } from "@clerk/nextjs";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function unauthorizedResponse() {
  return new Response(JSON.stringify({ message: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Authenticated fetch for the Choppr API.
 * Waits for a Clerk JWT before hitting the network, never sends without
 * Authorization, and retries once on 401 (stale token / signup race).
 */
export function useApiFetch() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  return useCallback(async (input: string, init: RequestInit = {}): Promise<Response> => {
    // Clerk finished loading and there is no session — don't call the API
    if (isLoaded && !isSignedIn) {
      return unauthorizedResponse();
    }

    let token = await getToken();

    // Wait for JWT — common right after hydration / signup redirect
    if (!token) {
      for (let i = 0; i < 30 && !token; i++) {
        await sleep(100);
        token = await getToken();
      }
    }

    // Still no token: fail locally (no Authorization header → noisy API 401s)
    if (!token) {
      return unauthorizedResponse();
    }

    const buildHeaders = (authToken: string): HeadersInit => ({
      ...(init.headers ?? {}),
      Authorization: `Bearer ${authToken}`,
      "Cache-Control": "no-store",
      ...(init.body && !(init.headers as Record<string, string> | undefined)?.["Content-Type"]
        ? { "Content-Type": "application/json" }
        : {}),
    });

    const doFetch = (authToken: string) =>
      fetch(input, {
        ...init,
        cache: "no-store",
        headers: buildHeaders(authToken),
      });

    let res = await doFetch(token);

    // Retry once on 401: stale JWT or parallel user-create race on the API
    if (res.status === 401) {
      await sleep(300);
      let fresh: string | null = null;
      try {
        fresh = await getToken({ skipCache: true });
      } catch {
        fresh = await getToken();
      }
      if (fresh) {
        res = await doFetch(fresh);
      }
    }

    return res;
  }, [getToken, isLoaded, isSignedIn]);
}
