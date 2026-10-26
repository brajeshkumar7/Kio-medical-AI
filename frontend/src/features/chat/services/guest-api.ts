import { API_URL, requestJson, responseError } from "@/lib/http/client";
import type { GuestUsage } from "../types";

const GUEST_URL = `${API_URL}/api/guest`;

export async function createGuestSession(): Promise<
  { token: string } & GuestUsage
> {
  const response = await fetch(`${GUEST_URL}/sessions`, {
    method: "POST",
    cache: "no-store",
  });
  if (!response.ok) throw await responseError(response);
  return response.json();
}

export async function getGuestStatus(token: string): Promise<GuestUsage> {
  return requestJson<GuestUsage>(`${GUEST_URL}/session`, token, {}, true);
}

export async function claimGuestSession(
  accountToken: string,
  guestToken: string,
): Promise<void> {
  const response = await fetch(`${GUEST_URL}/claim`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accountToken}`,
      "X-Kio-Guest-Token": guestToken,
    },
  });
  if (!response.ok) throw await responseError(response);
}
