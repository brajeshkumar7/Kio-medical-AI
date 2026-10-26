import { claimGuestSession, createGuestSession, getGuestStatus, type GuestUsage } from "@/lib/api";

const STORAGE_KEY = "kio-guest-token";
let bootstrap: Promise<{ token: string; usage: GuestUsage }> | null = null;

export function storedGuestToken(): string | null {
  return window.localStorage.getItem(STORAGE_KEY);
}

export function clearGuestToken(): void {
  window.localStorage.removeItem(STORAGE_KEY);
  bootstrap = null;
}

export function ensureGuestSession(): Promise<{ token: string; usage: GuestUsage }> {
  if (bootstrap) return bootstrap;
  bootstrap = (async () => {
    const existing = storedGuestToken();
    if (existing) {
      try {
        return { token: existing, usage: await getGuestStatus(existing) };
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("Guest session expired")) throw error;
        clearGuestToken();
      }
    }
    const session = await createGuestSession();
    window.localStorage.setItem(STORAGE_KEY, session.token);
    return { token: session.token, usage: session };
  })().finally(() => { bootstrap = null; });
  return bootstrap;
}

export async function transferGuestSession(accountToken: string): Promise<void> {
  const guestToken = storedGuestToken();
  if (!guestToken) return;
  await claimGuestSession(accountToken, guestToken);
  clearGuestToken();
}
