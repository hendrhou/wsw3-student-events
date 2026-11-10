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
      // Screens carry many trivial navigation closures (onOpen={() => navigate(...)});
      // the meaningful bar is lines/statements ≥80% (currently ~95%) with all critical
      // flows (register, 409 recovery, QR modal, interest save) behavior-tested.
      thresholds: { lines: 80, functions: 70, statements: 80, branches: 70 },
    },
  },
});
