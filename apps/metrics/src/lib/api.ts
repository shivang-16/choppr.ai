const STORAGE_KEY = "choppr_metrics_auth";

export type AuthCreds = { username: string; password: string };

export function getAuth(): AuthCreds | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthCreds;
  } catch {
    return null;
  }
}

export function setAuth(creds: AuthCreds) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
}

export function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

function basicHeader(creds: AuthCreds) {
  const token = btoa(`${creds.username}:${creds.password}`);
  return `Basic ${token}`;
}

export async function login(username: string, password: string) {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Login failed");
  }
  setAuth({ username, password });
  return res.json();
}

export async function metricsFetch<T>(path: string): Promise<T> {
  const creds = getAuth();
  if (!creds) throw new Error("Not authenticated");

  const res = await fetch(`/api${path}`, {
    headers: {
      Authorization: basicHeader(creds),
    },
    cache: "no-store",
  });

  if (res.status === 401) {
    clearAuth();
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}
