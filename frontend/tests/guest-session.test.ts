import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  createGuestSession: vi.fn(),
  getGuestStatus: vi.fn(),
  claimGuestSession: vi.fn(),
}));
vi.mock("@/features/chat/services/guest-api", () => api);
import {
  clearGuestToken,
  ensureGuestSession,
  storedGuestToken,
  transferGuestSession,
} from "@/features/chat/services/guest-session";

const usage = { remaining: 3, limit: 3, resetAt: "2030-01-01T00:00:00Z" };

beforeEach(() => {
  clearGuestToken();
  vi.resetAllMocks();
  api.createGuestSession.mockResolvedValue({ token: "new-token", ...usage });
  api.getGuestStatus.mockResolvedValue(usage);
});

describe("guest session lifecycle", () => {
  it("shares a concurrent bootstrap and persists the issued token", async () => {
    const first = ensureGuestSession();
    expect(ensureGuestSession()).toBe(first);
    await expect(first).resolves.toEqual({
      token: "new-token",
      usage: { token: "new-token", ...usage },
    });
    expect(api.createGuestSession).toHaveBeenCalledTimes(1);
    expect(storedGuestToken()).toBe("new-token");
  });

  it("reuses a valid persisted session", async () => {
    localStorage.setItem("kio-guest-token", "existing");
    await expect(ensureGuestSession()).resolves.toEqual({
      token: "existing",
      usage,
    });
    expect(api.createGuestSession).not.toHaveBeenCalled();
  });

  it("replaces an expired session, but keeps the token on a network failure", async () => {
    localStorage.setItem("kio-guest-token", "expired");
    api.getGuestStatus.mockRejectedValueOnce(
      new Error("Guest session expired"),
    );
    await ensureGuestSession();
    expect(storedGuestToken()).toBe("new-token");
    api.getGuestStatus.mockRejectedValueOnce(new Error("Network unavailable"));
    await expect(ensureGuestSession()).rejects.toThrow("Network unavailable");
    expect(storedGuestToken()).toBe("new-token");
    expect(api.createGuestSession).toHaveBeenCalledTimes(1);
  });

  it("only clears the guest token after a successful account claim", async () => {
    localStorage.setItem("kio-guest-token", "guest");
    api.claimGuestSession.mockRejectedValueOnce(new Error("Retry later"));
    await expect(transferGuestSession("account")).rejects.toThrow(
      "Retry later",
    );
    expect(storedGuestToken()).toBe("guest");
    await transferGuestSession("account");
    expect(api.claimGuestSession).toHaveBeenLastCalledWith("account", "guest");
    expect(storedGuestToken()).toBeNull();
    await transferGuestSession("account");
    expect(api.claimGuestSession).toHaveBeenCalledTimes(2);
  });
});
