export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

export function authorizedHeaders(token: string, guest = false): HeadersInit {
  return {
    Authorization: `${guest ? "Guest" : "Bearer"} ${token}`,
    "Content-Type": "application/json",
  };
}

export async function responseError(response: Response): Promise<Error> {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return new Error(payload?.error || `Request failed (${response.status})`);
}

export async function requestJson<T>(
  url: string,
  token: string,
  init: RequestInit = {},
  guest = false,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: authorizedHeaders(token, guest),
    cache: "no-store",
  });
  if (!response.ok) throw await responseError(response);
  return response.json() as Promise<T>;
}

export async function checkApiAvailability(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
