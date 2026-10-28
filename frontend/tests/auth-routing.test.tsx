import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
  redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound, redirect: mocks.redirect }));
vi.mock("@/features/auth/components/auth-shell", () => ({ default: () => null }));
vi.mock("@/features/auth/components/clerk-auth-form", () => ({ default: () => null }));

import RootPage from "@/app/[[...auth]]/page";
import nextConfig from "../next.config";

beforeEach(() => {
  mocks.auth.mockResolvedValue({ userId: null });
});

it.each(["favicon.png", "missing.svg", "missing.woff2", "missing.ico"])(
  "returns 404 for missing asset %s before calling Clerk",
  async (filename) => {
    await expect(RootPage({ params: Promise.resolve({ auth: [filename] }) }))
      .rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.auth).not.toHaveBeenCalled();
  },
);

it("keeps root and authentication subpaths available to signed-out users", async () => {
  for (const auth of [undefined, ["reset-password"], ["factor-one", "password"], ["user.name"]]) {
    await expect(RootPage({ params: Promise.resolve({ auth }) })).resolves.toBeTruthy();
  }
  expect(mocks.auth).toHaveBeenCalledTimes(4);
  expect(mocks.notFound).not.toHaveBeenCalled();
});

it("preserves the signed-in root redirect", async () => {
  mocks.auth.mockResolvedValue({ userId: "user-test" });
  await expect(RootPage({ params: Promise.resolve({}) })).rejects.toThrow("NEXT_REDIRECT");
  expect(mocks.redirect).toHaveBeenCalledWith("/console");
});

it("redirects the old PNG favicon URL to the existing icon", async () => {
  expect(await nextConfig.redirects?.()).toContainEqual({
    source: "/favicon.png", destination: "/favicon.ico", permanent: true,
  });
});
