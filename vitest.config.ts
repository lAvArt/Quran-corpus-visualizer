import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/coverage/**",
      "arabic-book-corpus-platform/**",
    ],
    pool: "forks",
    maxWorkers: 1,
    coverage: {
      provider: "v8",
      include: ["lib/**", "components/**"],
      exclude: ["**/*.d.ts", "**/*.test.*"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
