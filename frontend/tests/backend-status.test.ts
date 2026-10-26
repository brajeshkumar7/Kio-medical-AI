import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const probe = vi.hoisted(() => vi.fn());
vi.mock("@/lib/http/client", () => ({ checkApiAvailability: probe }));
import { useBackendStatus } from "@/features/chat/hooks/use-backend-status";

beforeEach(() => probe.mockReset());

it("recovers from offline, polls visible pages, and removes subscriptions on unmount", async () => {
  probe.mockResolvedValue(false);
  vi.useFakeTimers();
  const { result, unmount } = renderHook(() => useBackendStatus());
  await act(async () => {
    await Promise.resolve();
  });
  expect(result.current.backendStatus).toBe("offline");
  probe.mockResolvedValue(true);
  await act(async () => {
    await result.current.checkBackend(true);
  });
  expect(result.current.backendStatus).toBe("online");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(15000);
  });
  expect(probe).toHaveBeenCalledTimes(3);
  await act(async () => {
    window.dispatchEvent(new Event("online"));
  });
  expect(probe).toHaveBeenCalledTimes(4);
  unmount();
  window.dispatchEvent(new Event("online"));
  await vi.advanceTimersByTimeAsync(15000);
  expect(probe).toHaveBeenCalledTimes(4);
});
