import { useAuth } from "@clerk/nextjs";

export function useApiFetch() {
  const { getToken } = useAuth();

  return async (input: string, init: RequestInit = {}): Promise<Response> => {
    const token = await getToken();
    return fetch(input, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.body && !(init.headers as any)?.["Content-Type"]
          ? { "Content-Type": "application/json" }
          : {}),
      },
    });
  };
}
