import { useCallback } from "react";
import { useAuth } from "@clerk/nextjs";

export function useApiFetch() {
  const { getToken } = useAuth();

  return useCallback(async (input: string, init: RequestInit = {}): Promise<Response> => {
    const token = await getToken();
    return fetch(input, {
      ...init,
      cache: "no-store",
      headers: {
        ...(init.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "Cache-Control": "no-store",
        ...(init.body && !(init.headers as any)?.["Content-Type"]
          ? { "Content-Type": "application/json" }
          : {}),
      },
    });
  }, [getToken]);
}
