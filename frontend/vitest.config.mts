import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    env: { NEXT_PUBLIC_API_URL: "http://localhost:8080" },
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
    restoreMocks: true,
    clearMocks: true,
    setupFiles: ["./tests/setup.ts"],
  },
});
