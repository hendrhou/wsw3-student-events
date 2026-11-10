import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text"],
      include: ["src/screens/**", "src/lib/**"],
      // See student-mfe config for the functions-threshold rationale.
      thresholds: { lines: 80, functions: 70, statements: 80, branches: 70 },
    },
  },
});
