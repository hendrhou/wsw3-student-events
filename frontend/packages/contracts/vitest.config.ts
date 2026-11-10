import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    coverage: {
      provider: "v8",
      include: ["src/index.tsx"],
      reporter: ["text"],
      thresholds: { lines: 80, statements: 80, functions: 80, branches: 80 },
    },
  },
});